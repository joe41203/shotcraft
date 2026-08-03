import { icons } from "@/lib/icons";
import type { Message } from "@/lib/messages";
import {
	applyTheme,
	loadTheme,
	saveTheme,
	type ThemeName,
	THEMES,
} from "@/lib/ui-theme";

// data-icon 属性を持つ要素に対応する inline SVG を差し込む。
// アイコンの単一情報源を lib/icons.ts に保つため、HTML には直書きしない。
for (const el of document.querySelectorAll<HTMLElement>("[data-icon]")) {
	const name = el.dataset.icon as keyof typeof icons;
	if (name in icons) el.innerHTML = icons[name];
}

/**
 * UI テーマの色見本ボタン（5 個）を生成し、選択・保存・即時反映を配線する。
 * 単一情報源 THEMES から作るので、テーマを増減しても HTML を触らず追従する。
 * クリックで storage.local へ保存し、その場でポップアップにも適用する
 * （エディタ側は storage.onChanged で追従する）。
 */
async function initThemeSwatches(): Promise<void> {
	const container = document.getElementById("theme-swatches");
	if (!container) return;

	let current = await loadTheme();
	applyTheme(document.documentElement, current);

	const buttons = new Map<ThemeName, HTMLButtonElement>();

	/** 全ボタンの選択表示（aria-pressed）を現在値に合わせて更新する。 */
	function syncPressed(): void {
		for (const [name, btn] of buttons) {
			btn.setAttribute("aria-pressed", String(name === current));
		}
	}

	for (const t of THEMES) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "theme-swatch";
		btn.setAttribute("aria-label", t.label);
		// 面色を地に、アクセント色を小さな点で見せて配色の雰囲気を伝える。
		btn.style.setProperty("--swatch-surface", t.swatchSurface);
		btn.style.setProperty("--swatch-accent", t.swatchAccent);
		btn.addEventListener("click", () => {
			if (current === t.name) return;
			current = t.name;
			applyTheme(document.documentElement, current);
			syncPressed();
			void saveTheme(current);
		});
		buttons.set(t.name, btn);
		container.appendChild(btn);
	}
	syncPressed();
}

void initThemeSwatches();

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

document.getElementById("capture-full-page")?.addEventListener("click", () => {
	void send({ type: "CAPTURE_FULL_PAGE" });
});
