import { describe, expect, it } from "vitest";
import {
	applyTheme,
	DEFAULT_THEME,
	normalizeThemeName,
	THEMES,
	type ThemeName,
} from "../lib/ui-theme";

/**
 * data-theme 属性の設定/削除だけを検証するための最小スタブ要素。
 * vitest に DOM 環境（jsdom 等）を導入せず純粋な属性操作としてテストするため、
 * applyTheme が使う setAttribute / removeAttribute / getAttribute のみを持つ。
 */
function fakeRoot(): {
	el: HTMLElement;
	get(): string | null;
} {
	let attr: string | null = null;
	const el = {
		setAttribute(name: string, value: string): void {
			if (name === "data-theme") attr = value;
		},
		removeAttribute(name: string): void {
			if (name === "data-theme") attr = null;
		},
		getAttribute(name: string): string | null {
			return name === "data-theme" ? attr : null;
		},
	} as unknown as HTMLElement;
	return { el, get: () => attr };
}

describe("normalizeThemeName", () => {
	it("既知のテーマ名はそのまま通す", () => {
		for (const t of THEMES) {
			expect(normalizeThemeName(t.name)).toBe(t.name);
		}
	});

	it("未設定・不正値・型違いは既定（midnight）へ落とす", () => {
		expect(normalizeThemeName(undefined)).toBe("midnight");
		expect(normalizeThemeName(null)).toBe("midnight");
		expect(normalizeThemeName("")).toBe("midnight");
		expect(normalizeThemeName("dark")).toBe("midnight");
		expect(normalizeThemeName("Midnight")).toBe("midnight"); // 大文字違いは不正
		expect(normalizeThemeName(42)).toBe("midnight");
		expect(normalizeThemeName({ name: "light" })).toBe("midnight");
	});

	it("既定テーマ定数は midnight", () => {
		expect(DEFAULT_THEME).toBe("midnight");
	});
});

describe("applyTheme", () => {
	it("midnight は data-theme 属性を削除する（:root の既定にフォールバック）", () => {
		const { el, get } = fakeRoot();
		el.setAttribute("data-theme", "light"); // 事前に別テーマが付いている状態
		applyTheme(el, "midnight");
		expect(get()).toBeNull();
	});

	it("midnight 以外は data-theme=<name> を設定する", () => {
		for (const name of ["light", "ocean", "forest", "sunset"] as ThemeName[]) {
			const { el, get } = fakeRoot();
			applyTheme(el, name);
			expect(get()).toBe(name);
		}
	});

	it("不正値は midnight として扱い属性を削除する", () => {
		const { el, get } = fakeRoot();
		el.setAttribute("data-theme", "ocean");
		applyTheme(el, "not-a-theme");
		expect(get()).toBeNull();
	});
});

describe("THEMES メタ情報", () => {
	it("既定テーマ midnight を先頭に含み、全 5 種を持つ", () => {
		expect(THEMES).toHaveLength(5);
		expect(THEMES[0]?.name).toBe("midnight");
		const names = THEMES.map((t) => t.name).sort();
		expect(names).toEqual(["forest", "light", "midnight", "ocean", "sunset"]);
	});

	it("各テーマは表示名と 2 種の代表色（#rrggbb）を持つ", () => {
		for (const t of THEMES) {
			expect(t.label.length).toBeGreaterThan(0);
			expect(t.swatchSurface).toMatch(/^#[0-9a-f]{6}$/i);
			expect(t.swatchAccent).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	it("テーマ名に重複が無い", () => {
		const names = THEMES.map((t) => t.name);
		expect(new Set(names).size).toBe(names.length);
	});
});
