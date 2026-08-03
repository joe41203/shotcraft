/**
 * UI カラーテーマの永続化と適用。
 *
 * ポップアップで選んだ UI テーマ（midnight / light / ocean / forest / sunset）を
 * browser.storage.local に保存し、popup / editor の起動時に読み込んで
 * document.documentElement の data-theme 属性へ反映する。style-prefs.ts と同じ
 * storage.local のパターンを踏襲する（画像データ・編集内容は storage.session の
 * まま。ここで扱うのは UI の見た目設定だけ）。
 *
 * 実際の配色は assets/tokens.css の [data-theme="..."] ブロックが持つ。ここは
 * 「どのテーマ名か」だけを管理し、値そのものは持たない。テーマ名を増減するときは
 * tokens.css の [data-theme] ブロックと同期させる（THEMES / ThemeName / tokens.css
 * の 3 者一致）。
 *
 * 純粋部分（normalizeThemeName・applyTheme のクラス無し版に相当する属性操作）は
 * tests/ui-theme.test.ts でユニットテスト対象にする。
 *
 * 注記: 注釈（Konva の図形色）のパレットとは無関係。こちらは UI の色で、注釈の
 * 色は style-prefs.ts / 色スウォッチが別に持つ。
 */

/** 選択できる UI テーマの名前。tokens.css の [data-theme] ブロックと一致させる。 */
export type ThemeName = "midnight" | "light" | "ocean" | "forest" | "sunset";

/** 既定テーマ。data-theme 属性が無い状態（:root の既定）がこれに対応する。 */
export const DEFAULT_THEME: ThemeName = "midnight";

/** テーマ 1 件のメタ情報（選択 UI に出す表示名と色見本用の代表色）。 */
export interface ThemeInfo {
	/** テーマ名（storage 保存値・data-theme 属性値と一致）。 */
	name: ThemeName;
	/** 選択 UI のラベル・aria-label に使う日本語表示名。 */
	label: string;
	/** 色見本ボタンの背景に使う面の代表色（各テーマの --surface 相当）。 */
	swatchSurface: string;
	/** 色見本ボタンに載せるアクセントの代表色（各テーマの --accent 相当）。 */
	swatchAccent: string;
}

/**
 * 選択できるテーマの一覧（表示順）。色見本の代表色は tokens.css の該当テーマの
 * --surface / --accent と揃える（見本と実際の配色がずれないようにする）。
 */
export const THEMES: readonly ThemeInfo[] = [
	{
		name: "midnight",
		label: "ミッドナイト",
		swatchSurface: "#161b26",
		swatchAccent: "#10b981",
	},
	{
		name: "light",
		label: "ライト",
		swatchSurface: "#ffffff",
		swatchAccent: "#047857",
	},
	{
		name: "ocean",
		label: "オーシャン",
		swatchSurface: "#131c28",
		swatchAccent: "#0ea5e9",
	},
	{
		name: "forest",
		label: "フォレスト",
		swatchSurface: "#141e19",
		swatchAccent: "#22c55e",
	},
	{
		name: "sunset",
		label: "サンセット",
		swatchSurface: "#201712",
		swatchAccent: "#f59e0b",
	},
] as const;

/** storage.local のキー。style-prefs（"style-prefs"）とは名前空間を分ける。 */
export const UI_THEME_KEY = "ui-theme";

/**
 * 任意の値を ThemeName へ正規化する純粋関数。
 * THEMES に含まれる名前ならそのまま、それ以外（未設定・不正値・旧バージョンの値）は
 * 既定の "midnight" へ落とす。壊れた保存値でも UI が必ず既定で立ち上がる。
 */
export function normalizeThemeName(raw: unknown): ThemeName {
	if (typeof raw === "string" && THEMES.some((t) => t.name === raw)) {
		return raw as ThemeName;
	}
	return DEFAULT_THEME;
}

/**
 * テーマを DOM のルート要素へ適用する純粋な属性操作。
 * midnight は data-theme 属性を削除して :root の既定にフォールバックし、それ以外は
 * data-theme="<name>" を設定する。root には通常 document.documentElement を渡す。
 * 不正値は normalizeThemeName で midnight に落としてから適用する。
 */
export function applyTheme(root: HTMLElement, name: unknown): void {
	const theme = normalizeThemeName(name);
	if (theme === "midnight") {
		root.removeAttribute("data-theme");
	} else {
		root.setAttribute("data-theme", theme);
	}
}

/**
 * 保存済みテーマを storage.local から読み込んで正規化する。
 * 保存値が無い・読み取りに失敗した場合も既定（midnight）を返す（起動を止めない）。
 */
export async function loadTheme(): Promise<ThemeName> {
	try {
		const result = await browser.storage.local.get(UI_THEME_KEY);
		return normalizeThemeName(result[UI_THEME_KEY]);
	} catch {
		return DEFAULT_THEME;
	}
}

/** テーマ名を storage.local に保存する。 */
export async function saveTheme(name: ThemeName): Promise<void> {
	await browser.storage.local.set({ [UI_THEME_KEY]: name });
}
