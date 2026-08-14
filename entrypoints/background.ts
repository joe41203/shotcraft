import type { Browser } from "wxt/browser";
import { ERROR_BADGE_TEXT } from "@/lib/capture-badge";
import { type CaptureRecord, saveCapture } from "@/lib/capture-store";
import { cssRectToBitmapRect } from "@/lib/geometry";
import type { Message, Rect, Size } from "@/lib/messages";

/**
 * captureVisibleTab は 2 回/秒に制限される。超過分を破棄せず、
 * 直近呼び出しのタイムスタンプを管理してスロットが空くまで待つ。
 */
const CAPTURE_MIN_INTERVAL_MS = 600;

/** 範囲選択 content script のビルド出力パス（WXT の runtime 登録の出力先）。 */
const REGION_SELECT_SCRIPT = "/content-scripts/region-select.js";

/** 失敗バッジの背景色（danger。tokens.css の --danger と同系統）。 */
const BADGE_ERROR_COLOR = "#f87171";
/** 失敗バッジ（!）を自動で消すまでの表示時間（ms）。 */
const ERROR_BADGE_DURATION_MS = 4000;

export default defineBackground(() => {
	let nextCaptureAt = 0;
	/** 失敗バッジの自動クリア用タイマー。次の失敗が起きたら張り直す。 */
	let errorBadgeTimer: ReturnType<typeof setTimeout> | null = null;

	// --- 拡張アイコンのバッジ（失敗の可視化） ---

	/** 表示中のバッジを消す（失敗バッジの表示時間が切れたときに呼ぶ）。 */
	async function clearBadge(): Promise<void> {
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
