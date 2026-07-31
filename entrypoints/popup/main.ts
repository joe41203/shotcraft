import type { Message } from "@/lib/messages";

/**
 * background へメッセージを送ってからポップアップを閉じる。
 * 範囲選択はポップアップが閉じないとページ上でドラッグできないため、
 * 送信の成否にかかわらず必ず閉じる。
 */
async function send(message: Message): Promise<void> {
	try {
		await browser.runtime.sendMessage(message);
	} finally {
		window.close();
	}
}

document.getElementById("capture-visible")?.addEventListener("click", () => {
	void send({ type: "CAPTURE_VISIBLE" });
});

document.getElementById("capture-region")?.addEventListener("click", () => {
	void send({ type: "START_REGION_SELECT" });
});
