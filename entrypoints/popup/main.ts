import { icons } from "@/lib/icons";
import type { Message } from "@/lib/messages";

// data-icon 属性を持つ要素に対応する inline SVG を差し込む。
// アイコンの単一情報源を lib/icons.ts に保つため、HTML には直書きしない。
for (const el of document.querySelectorAll<HTMLElement>("[data-icon]")) {
	const name = el.dataset.icon as keyof typeof icons;
	if (name in icons) el.innerHTML = icons[name];
}

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
