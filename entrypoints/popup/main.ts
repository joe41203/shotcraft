import { CAPTURE_DELAY_OPTIONS } from "@/lib/capture-delay";
import { icons } from "@/lib/icons";
import type { Message } from "@/lib/messages";

// data-icon 属性を持つ要素に対応する inline SVG を差し込む。
// アイコンの単一情報源を lib/icons.ts に保つため、HTML には直書きしない。
for (const el of document.querySelectorAll<HTMLElement>("[data-icon]")) {
	const name = el.dataset.icon as keyof typeof icons;
	if (name in icons) el.innerHTML = icons[name];
}

/**
 * 遅延キャプチャの待機時間（ms）。3 ボタン共通の設定として保持し、
 * 「表示範囲」「ページ全体」に適用する（範囲選択はオーバーレイ表示前に
 * 待つ意味になり用途が薄いため対象外）。既定は 0（即時）で、後方互換のため
 * 未選択時は delayMs を付けない。
 */
let captureDelayMs = 0;

/** タイマー選択のセグメントボタンを組み立てる（なし/3秒/5秒）。 */
const delayContainer = document.getElementById("capture-delay");
if (delayContainer) {
	const buttons: HTMLButtonElement[] = [];
	for (const opt of CAPTURE_DELAY_OPTIONS) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "delay-segment";
		btn.textContent = opt.label;
		btn.setAttribute("aria-pressed", String(opt.value === captureDelayMs));
		if (opt.value === captureDelayMs) btn.classList.add("active");
		btn.addEventListener("click", () => {
			captureDelayMs = opt.value;
			for (const b of buttons) {
				const on = b === btn;
				b.classList.toggle("active", on);
				b.setAttribute("aria-pressed", String(on));
			}
		});
		buttons.push(btn);
		delayContainer.append(btn);
	}
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
	// delayMs=0（即時）のときは省略して従来どおりのメッセージにする（後方互換）。
	void send(
		captureDelayMs > 0
			? { type: "CAPTURE_VISIBLE", delayMs: captureDelayMs }
			: { type: "CAPTURE_VISIBLE" },
	);
});

document.getElementById("capture-region")?.addEventListener("click", () => {
	// 範囲選択は遅延対象外（待ってもオーバーレイ表示前に待つだけで用途が薄い）。
	void send({ type: "START_REGION_SELECT" });
});

document.getElementById("capture-full-page")?.addEventListener("click", () => {
	// 表示範囲と同様に遅延を適用する（0 のときは省略・後方互換）。
	void send(
		captureDelayMs > 0
			? { type: "CAPTURE_FULL_PAGE", delayMs: captureDelayMs }
			: { type: "CAPTURE_FULL_PAGE" },
	);
});
