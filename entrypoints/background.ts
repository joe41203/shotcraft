import { type CaptureRecord, saveCapture } from "@/lib/capture-store";
import type { Message } from "@/lib/messages";

/**
 * captureVisibleTab は 2 回/秒に制限される。超過分を破棄せず、
 * 直近呼び出しのタイムスタンプを管理してスロットが空くまで待つ。
 */
const CAPTURE_MIN_INTERVAL_MS = 600;

export default defineBackground(() => {
	let nextCaptureAt = 0;

	browser.runtime.onMessage.addListener((message: Message) => {
		switch (message.type) {
			case "CAPTURE_VISIBLE":
				void captureVisible();
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
		}
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
