import type { Browser } from "wxt/browser";
import { ERROR_BADGE_TEXT, formatTileProgressBadge } from "@/lib/capture-badge";
import { type CaptureRecord, saveCapture } from "@/lib/capture-store";
import { cssRectToBitmapRect, planFullPageTiles } from "@/lib/geometry";
import type { Message, Rect, Size } from "@/lib/messages";

/**
 * captureVisibleTab は 2 回/秒に制限される。超過分を破棄せず、
 * 直近呼び出しのタイムスタンプを管理してスロットが空くまで待つ。
 */
const CAPTURE_MIN_INTERVAL_MS = 600;

/** 範囲選択 content script のビルド出力パス（WXT の runtime 登録の出力先）。 */
const REGION_SELECT_SCRIPT = "/content-scripts/region-select.js";

/**
 * フルページキャプチャで撮影するページ高さの上限（CSS px）。
 * 極端に長いページはタイル数・キャンバスサイズが過大になるため、ここまでで打ち切る。
 */
const MAX_FULL_PAGE_HEIGHT = 20000;

/** 各タイル撮影前の待機（遅延読み込み・スクロール追従描画の反映を待つ）。 */
const FULL_PAGE_SETTLE_MS = 250;

/** 進行バッジの背景色（accent。tokens.css の --accent と同系統）。 */
const BADGE_PROGRESS_COLOR = "#10b981";
/** 失敗バッジの背景色（danger。tokens.css の --danger と同系統）。 */
const BADGE_ERROR_COLOR = "#f87171";
/** 失敗バッジ（!）を自動で消すまでの表示時間（ms）。 */
const ERROR_BADGE_DURATION_MS = 4000;

export default defineBackground(() => {
	let nextCaptureAt = 0;
	/** 失敗バッジの自動クリア用タイマー。新しい進行が始まったら無効化する。 */
	let errorBadgeTimer: ReturnType<typeof setTimeout> | null = null;

	// --- 拡張アイコンのバッジ（進行・失敗の可視化） ---

	/**
	 * 進行バッジを描く（テキスト空文字でクリア）。失敗バッジの自動クリア待ちが
	 * あればここで打ち切る（新しい進行表示を失敗タイマーが上書き消去しないため）。
	 * バッジ API は失敗しても致命的でないため握りつぶす（本処理を止めない）。
	 */
	async function setProgressBadge(text: string): Promise<void> {
		if (errorBadgeTimer) {
			clearTimeout(errorBadgeTimer);
			errorBadgeTimer = null;
		}
		try {
			await browser.action.setBadgeBackgroundColor({
				color: BADGE_PROGRESS_COLOR,
			});
			await browser.action.setBadgeText({ text });
		} catch {
			// バッジ表示は補助的な演出。失敗しても撮影処理は続行する。
		}
	}

	/**
	 * 進行バッジを消す（完了・キャンセル時に必ず呼ぶ）。
	 * ただし失敗バッジ（!）を表示中（errorBadgeTimer が生きている）ときは消さない。
	 * 失敗経路では catch で flashErrorBadge → finally で clearBadge の順に走るため、
	 * ここで無条件に消すと "!" が一瞬で消えてしまう。失敗バッジは自分のタイマーで消す。
	 */
	async function clearBadge(): Promise<void> {
		if (errorBadgeTimer) return;
		try {
			await browser.action.setBadgeText({ text: "" });
		} catch {
			// クリア失敗も致命的でない。
		}
	}

	/**
	 * 失敗バッジ（!・赤背景）を出し、ERROR_BADGE_DURATION_MS 後に自動で消す。
	 * キャプチャ不可ページや例外など、ユーザーに「押しても無反応」と映る経路で使う。
	 */
	async function flashErrorBadge(): Promise<void> {
		if (errorBadgeTimer) {
			clearTimeout(errorBadgeTimer);
			errorBadgeTimer = null;
		}
		try {
			await browser.action.setBadgeBackgroundColor({
				color: BADGE_ERROR_COLOR,
			});
			await browser.action.setBadgeText({ text: ERROR_BADGE_TEXT });
		} catch {
			// 失敗通知バッジ自体の表示に失敗しても致命的でない。
		}
		errorBadgeTimer = setTimeout(() => {
			errorBadgeTimer = null;
			void clearBadge();
		}, ERROR_BADGE_DURATION_MS);
	}

	browser.runtime.onMessage.addListener((message: Message, sender) => {
		switch (message.type) {
			case "CAPTURE_VISIBLE":
				void captureVisible();
				break;
			case "START_REGION_SELECT":
				void startRegionSelect();
				break;
			case "CAPTURE_FULL_PAGE":
				void captureFullPage();
				break;
			case "REGION_SELECTED":
				void captureRegion(sender.tab, message.rect, message.viewport);
				break;
			case "REGION_CANCELLED":
				break;
		}
	});

	/**
	 * レート制限枠を予約し、必要ならその分だけ待つ。
	 * ユーザー操作を黙って捨てないため、破棄ではなく遅延で吸収する。
	 */
	async function waitForCaptureSlot(): Promise<void> {
		const now = Date.now();
		const at = Math.max(now, nextCaptureAt);
		nextCaptureAt = at + CAPTURE_MIN_INTERVAL_MS;
		if (at > now) {
			await new Promise((resolve) => setTimeout(resolve, at - now));
		}
	}

	/** 表示範囲をキャプチャする。 */
	async function captureVisible(): Promise<void> {
		const [tab] = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (!tab?.id) return;
		await waitForCaptureSlot();
		try {
			const dataUrl = await browser.tabs.captureVisibleTab({ format: "png" });
			const { width, height } = await imageSize(dataUrl);
			await openViewer({
				dataUrl,
				width,
				height,
				sourceUrl: tab.url ?? "",
				sourceTitle: tab.title ?? "",
				// バグ報告用のコンテキスト。URL/タイトルは取れれば記録（chrome:// 等は空文字
				// になり得るので undefined へ落とす）。表示範囲キャプチャは viewport を計測
				// しない（追加注入を避ける）ため viewport は省略する。
			});
		} catch (error) {
			console.warn("[shotcraft] 表示範囲のキャプチャに失敗しました", error);
			await flashErrorBadge();
		}
	}

	async function startRegionSelect(): Promise<void> {
		const [tab] = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (!tab?.id) return;
		try {
			await browser.scripting.executeScript({
				target: { tabId: tab.id },
				files: [REGION_SELECT_SCRIPT],
			});
		} catch (error) {
			// chrome:// や Chrome Web Store など注入不可のページ。console.warn に加え、
			// 「押しても無反応」と映らないよう拡張アイコンに失敗バッジ（!）を出す。
			console.warn("[shotcraft] このページでは範囲選択を開始できません", error);
			await flashErrorBadge();
		}
	}

	/**
	 * ページを上から viewport 単位でスクロールしながら撮影し、1 枚の縦長 PNG に繋ぐ。
	 *
	 * 計測・スクロール・固定要素の表示制御は scripting.executeScript の注入関数で行い、
	 * 結果を戻り値で同期的に受ける（メッセージ往復を避ける）。撮影は必ず
	 * waitForCaptureSlot() を通してレート制限を守る。固定ヘッダーは 2 枚目以降を非表示にして
	 * 各タイルへの写り込みを防ぎ、撮影後に必ず元へ戻す。
	 */
	async function captureFullPage(): Promise<void> {
		// 進行バッジ（タイル進捗・失敗）を成否によらず必ず消すため、
		// タイル撮影を 1 つの try/finally で囲う。
		try {
			const [tab] = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			if (!tab?.id) return;
			const tabId = tab.id;

			let metrics: FullPageMetrics | null = null;
			try {
				metrics = await runInPage(tabId, measurePageFn);
			} catch (error) {
				// chrome:// や Chrome Web Store など注入不可のページ。console.warn に加え、
				// 「押しても無反応」と映らないよう拡張アイコンに失敗バッジ（!）を出す。
				console.warn(
					"[shotcraft] このページではページ全体をキャプチャできません",
					error,
				);
				await flashErrorBadge();
				return;
			}
			if (!metrics) return;

			const { originalScrollX, originalScrollY, viewportHeight, hasFixed } =
				metrics;

			// 撮影対象の高さは上限で打ち切る。切った場合は既知の制限として info を出す。
			const pageHeight = Math.min(metrics.pageHeight, MAX_FULL_PAGE_HEIGHT);
			if (metrics.pageHeight > MAX_FULL_PAGE_HEIGHT) {
				console.info(
					`[shotcraft] ページが長いため上限 ${MAX_FULL_PAGE_HEIGHT}px までを撮影します（実際の高さ ${metrics.pageHeight}px）`,
				);
			}

			try {
				const stitched = await captureAndStitch(tabId, {
					pageHeight,
					viewportHeight,
					hasFixed,
					// タイルを撮るたびに進捗バッジ（"1/5" 形式・収まらなければ割合）を更新する。
					onTileProgress: (done, total) =>
						setProgressBadge(formatTileProgressBadge(done, total)),
				});
				if (!stitched) return;
				await openViewer({
					dataUrl: stitched.dataUrl,
					width: stitched.width,
					height: stitched.height,
					sourceUrl: tab.url ?? "",
					sourceTitle: tab.title ?? "",
					// バグ報告用のコンテキスト。フルページは measurePage で viewport を計測済み
					// なので、その CSS px を記録する（撮影自体は縦長へ連結されるが、画面サイズは
					// 撮影時のビューポートが妥当）。
					viewport: {
						width: metrics.viewportWidth,
						height: metrics.viewportHeight,
					},
				});
			} catch (error) {
				console.warn("[shotcraft] ページ全体のキャプチャに失敗しました", error);
				await flashErrorBadge();
			} finally {
				// スクロール位置と固定要素の表示を必ず元へ戻す（撮影の成否によらず）。
				try {
					await runInPage(tabId, restorePageFn, [
						originalScrollX,
						originalScrollY,
					]);
				} catch (error) {
					console.warn("[shotcraft] ページ状態の復元に失敗しました", error);
				}
			}
		} finally {
			// 進行バッジ（タイル進捗）を必ず消す。
			// 失敗バッジ（!）を出した経路では clearBadge が no-op になり、"!" は残る。
			await clearBadge();
		}
	}

	/**
	 * タイルを順に撮影し、OffscreenCanvas 上で縦に繋いだ PNG dataUrl を返す。
	 * タイル配置は planFullPageTiles（純粋関数）に委ね、ここは撮影と描画に徹する。
	 */
	async function captureAndStitch(
		tabId: number,
		opts: {
			pageHeight: number;
			viewportHeight: number;
			hasFixed: boolean;
			/** タイルを 1 枚撮る（描く）たびに (完了枚数, 総枚数) で呼ばれる。進捗表示用。 */
			onTileProgress?: (done: number, total: number) => void | Promise<void>;
		},
	): Promise<{ dataUrl: string; width: number; height: number } | null> {
		const { pageHeight, viewportHeight, hasFixed, onTileProgress } = opts;

		// 先頭タイルを撮り、bitmap 実寸から実測スケール（bitmap 高 / viewport 高）を得る。
		await runInPage(tabId, scrollToFn, [0]);
		await settle();
		const first = await captureTab(tabId);
		const firstBitmap = await decodeBitmap(first);

		const scale = firstBitmap.height / viewportHeight;
		const tiles = planFullPageTiles({ pageHeight, viewportHeight, scale });
		if (tiles.length === 0) {
			firstBitmap.close();
			return null;
		}

		const canvasWidth = firstBitmap.width;
		const canvasHeight = tiles.reduce((sum, t) => sum + t.srcHeight, 0);
		const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			firstBitmap.close();
			return null;
		}

		// 固定要素は 2 枚目以降の撮影の間だけ非表示にする（先頭タイルには写す）。
		let fixedHidden = false;
		try {
			for (const [i, tile] of tiles.entries()) {
				let bitmap: ImageBitmap;
				if (i === 0 && tile.scrollY === 0) {
					// 先頭タイルは実寸取得のため既に撮影済み。使い回す。
					bitmap = firstBitmap;
				} else {
					if (hasFixed && !fixedHidden) {
						await runInPage(tabId, setFixedHiddenFn, [true]);
						fixedHidden = true;
					}
					await runInPage(tabId, scrollToFn, [tile.scrollY]);
					await settle();
					bitmap = await decodeBitmap(await captureTab(tabId));
				}
				// このタイルを撮り終えた時点の進捗（i+1 / 総数）を通知する。
				await onTileProgress?.(i + 1, tiles.length);
				try {
					ctx.drawImage(
						bitmap,
						0,
						tile.srcY,
						canvasWidth,
						tile.srcHeight,
						0,
						tile.destY,
						canvasWidth,
						tile.srcHeight,
					);
				} finally {
					bitmap.close();
				}
			}
		} finally {
			if (fixedHidden) {
				try {
					await runInPage(tabId, setFixedHiddenFn, [false]);
				} catch (error) {
					console.warn("[shotcraft] 固定要素の表示復元に失敗しました", error);
				}
			}
		}

		const outBlob = await canvas.convertToBlob({ type: "image/png" });
		const dataUrl = await blobToDataUrl(outBlob);
		return { dataUrl, width: canvasWidth, height: canvasHeight };
	}

	/** レート制限枠を確保してからアクティブタブの表示範囲を PNG dataUrl で撮る。 */
	async function captureTab(tabId: number): Promise<string> {
		await waitForCaptureSlot();
		const tab = await browser.tabs.get(tabId);
		const windowId = tab.windowId ?? browser.windows.WINDOW_ID_CURRENT;
		return await browser.tabs.captureVisibleTab(windowId, { format: "png" });
	}

	async function decodeBitmap(dataUrl: string): Promise<ImageBitmap> {
		const blob = await (await fetch(dataUrl)).blob();
		return await createImageBitmap(blob);
	}

	async function settle(): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, FULL_PAGE_SETTLE_MS));
	}

	/**
	 * ページ実行コンテキストで関数を注入・実行し、戻り値を受け取る。
	 * 注入関数は background のクロージャを参照できないため、引数と戻り値で完結させる。
	 */
	async function runInPage<A extends unknown[], R>(
		tabId: number,
		func: (...args: A) => R,
		args?: A,
	): Promise<R> {
		const [result] = await browser.scripting.executeScript({
			target: { tabId },
			func: func as (...a: unknown[]) => unknown,
			args: (args ?? []) as unknown[],
		});
		return result?.result as R;
	}

	async function captureRegion(
		tab: Browser.tabs.Tab | undefined,
		rect: Rect,
		viewport: Size,
	): Promise<void> {
		await waitForCaptureSlot();
		try {
			const windowId = tab?.windowId ?? browser.windows.WINDOW_ID_CURRENT;
			const dataUrl = await browser.tabs.captureVisibleTab(windowId, {
				format: "png",
			});
			const cropped = await cropDataUrl(dataUrl, rect, viewport);
			if (!cropped) return;
			await openViewer({
				dataUrl: cropped.dataUrl,
				width: cropped.width,
				height: cropped.height,
				sourceUrl: tab?.url ?? "",
				sourceTitle: tab?.title ?? "",
				// バグ報告用のコンテキスト。範囲選択は REGION_SELECTED の viewport（CSS px）を
				// そのまま記録する。URL/タイトルは取れれば記録する。
				viewport: { width: viewport.width, height: viewport.height },
			});
		} catch (error) {
			console.warn("[shotcraft] 範囲キャプチャに失敗しました", error);
			await flashErrorBadge();
		}
	}

	/**
	 * 表示領域全体の dataUrl を CSS px の選択矩形でクロップし、PNG の dataUrl を返す。
	 * service worker では Canvas 要素が使えないため OffscreenCanvas を用いる。
	 * 座標変換は devicePixelRatio ではなく bitmap と viewport の実測比で行う。
	 */
	async function cropDataUrl(
		dataUrl: string,
		rect: Rect,
		viewport: Size,
	): Promise<{ dataUrl: string; width: number; height: number } | null> {
		const blob = await (await fetch(dataUrl)).blob();
		const bitmap = await createImageBitmap(blob);
		try {
			const region = cssRectToBitmapRect(rect, viewport, {
				width: bitmap.width,
				height: bitmap.height,
			});
			if (!region) return null;
			const canvas = new OffscreenCanvas(region.width, region.height);
			const ctx = canvas.getContext("2d");
			if (!ctx) return null;
			ctx.drawImage(
				bitmap,
				region.x,
				region.y,
				region.width,
				region.height,
				0,
				0,
				region.width,
				region.height,
			);
			const outBlob = await canvas.convertToBlob({ type: "image/png" });
			const outUrl = await blobToDataUrl(outBlob);
			return { dataUrl: outUrl, width: region.width, height: region.height };
		} finally {
			bitmap.close();
		}
	}

	async function blobToDataUrl(blob: Blob): Promise<string> {
		return await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(blob);
		});
	}

	/**
	 * dataUrl をデコードして実寸を得る。service worker には Image が無いため
	 * createImageBitmap を使う。
	 */
	async function imageSize(
		dataUrl: string,
	): Promise<{ width: number; height: number }> {
		const blob = await (await fetch(dataUrl)).blob();
		const bitmap = await createImageBitmap(blob);
		const { width, height } = bitmap;
		bitmap.close();
		return { width, height };
	}

	/**
	 * ビューアタブを開くのは保存後。先にタブを開くとアクティブタブが変わり
	 * 以降のキャプチャが誤対象になるため、順序を厳守する。
	 */
	async function openViewer(
		capture: Omit<CaptureRecord, "id" | "capturedAt">,
	): Promise<void> {
		const record: CaptureRecord = {
			...capture,
			id: crypto.randomUUID(),
			capturedAt: Date.now(),
		};
		await saveCapture(record);
		await browser.tabs.create({ url: `/editor.html?id=${record.id}` });
	}
});

/** measurePageFn がページから返す計測値。 */
interface FullPageMetrics {
	pageHeight: number;
	viewportWidth: number;
	viewportHeight: number;
	devicePixelRatio: number;
	originalScrollX: number;
	originalScrollY: number;
	hasFixed: boolean;
}

// --- 以下はページ実行コンテキストへ注入される関数群 ---
// background のクロージャ変数・import を参照できない。引数と戻り値だけで完結させる。

/** ページ全体の寸法・現在のスクロール位置・固定/粘着要素の有無を計測する。 */
function measurePageFn(): FullPageMetrics {
	const doc = document.documentElement;
	const body = document.body;
	// scrollHeight は要素により差が出るため documentElement / body の大きい方を採る。
	const pageHeight = Math.max(
		doc.scrollHeight,
		body ? body.scrollHeight : 0,
		doc.clientHeight,
	);
	let hasFixed = false;
	for (const el of Array.from(document.body.querySelectorAll("*"))) {
		const pos = getComputedStyle(el).position;
		if (pos === "fixed" || pos === "sticky") {
			hasFixed = true;
			break;
		}
	}
	return {
		pageHeight,
		viewportWidth: window.innerWidth,
		viewportHeight: window.innerHeight,
		devicePixelRatio: window.devicePixelRatio,
		originalScrollX: window.scrollX,
		originalScrollY: window.scrollY,
		hasFixed,
	};
}

/** 指定 Y までスクロールする（アニメーションなしで即時）。 */
function scrollToFn(y: number): void {
	window.scrollTo({ top: y, left: 0, behavior: "auto" });
}

/** スクロール位置を元へ戻す。 */
function restorePageFn(x: number, y: number): void {
	// 固定要素を隠すために付けたスタイルタグが残っていれば除去する（保険）。
	document.getElementById("__shotcraftFullPageStyle")?.remove();
	window.scrollTo({ top: y, left: x, behavior: "auto" });
}

/**
 * position:fixed / sticky の要素を一括で非表示/復帰する。
 * style タグ 1 枚の挿入/除去で行い、個別要素の style を書き換えないため副作用が最小。
 */
function setFixedHiddenFn(hidden: boolean): void {
	const id = "__shotcraftFullPageStyle";
	const existing = document.getElementById(id);
	if (!hidden) {
		// スタイルタグを外し、目印に付けた data 属性も全て取り除いて完全に元へ戻す。
		existing?.remove();
		for (const el of Array.from(
			document.querySelectorAll("[data-shotcraft-fixed]"),
		)) {
			(el as HTMLElement).removeAttribute("data-shotcraft-fixed");
		}
		return;
	}
	if (existing) return;
	// computed style で fixed/sticky を判定して目印の data 属性を付け、
	// それを CSS セレクタ 1 枚で隠す。個別要素の style を書き換えないため副作用が最小。
	for (const el of Array.from(document.body.querySelectorAll("*"))) {
		const pos = getComputedStyle(el).position;
		if (pos === "fixed" || pos === "sticky") {
			(el as HTMLElement).dataset.shotcraftFixed = "1";
		}
	}
	const style = document.createElement("style");
	style.id = id;
	style.textContent =
		'[data-shotcraft-fixed="1"] { visibility: hidden !important; }';
	document.head.appendChild(style);
}
