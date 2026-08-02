import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createStylePrefsSaver,
	DEFAULT_STYLE_PREFS,
	normalizeStylePrefs,
	type StylePrefs,
	stylePrefsEqual,
} from "../lib/editor/style-prefs";
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from "../lib/editor/text";

describe("normalizeStylePrefs", () => {
	it("有効な値はそのまま通す", () => {
		const raw: StylePrefs = { stroke: "#34d399", dash: true, fontSize: 40 };
		expect(normalizeStylePrefs(raw)).toEqual(raw);
	});

	it("非オブジェクト（null / undefined / 文字列 / 数値）は全て既定へ", () => {
		expect(normalizeStylePrefs(null)).toEqual(DEFAULT_STYLE_PREFS);
		expect(normalizeStylePrefs(undefined)).toEqual(DEFAULT_STYLE_PREFS);
		expect(normalizeStylePrefs("x")).toEqual(DEFAULT_STYLE_PREFS);
		expect(normalizeStylePrefs(42)).toEqual(DEFAULT_STYLE_PREFS);
	});

	it("欠損キーはそれぞれ既定へフォールバックする", () => {
		expect(normalizeStylePrefs({})).toEqual(DEFAULT_STYLE_PREFS);
		expect(normalizeStylePrefs({ stroke: "#000000" })).toEqual({
			...DEFAULT_STYLE_PREFS,
			stroke: "#000000",
		});
	});

	it("stroke は非空文字列のみ受け付け、空文字・非文字列は既定色へ", () => {
		expect(normalizeStylePrefs({ stroke: "" }).stroke).toBe(
			DEFAULT_STYLE_PREFS.stroke,
		);
		expect(normalizeStylePrefs({ stroke: 123 }).stroke).toBe(
			DEFAULT_STYLE_PREFS.stroke,
		);
		expect(normalizeStylePrefs({ stroke: "rgb(1,2,3)" }).stroke).toBe(
			"rgb(1,2,3)",
		);
	});

	it("dash は boolean 以外を false（実線）へ落とす", () => {
		expect(normalizeStylePrefs({ dash: true }).dash).toBe(true);
		expect(normalizeStylePrefs({ dash: false }).dash).toBe(false);
		expect(normalizeStylePrefs({ dash: "true" }).dash).toBe(false);
		expect(normalizeStylePrefs({ dash: 1 }).dash).toBe(false);
	});

	it("fontSize は clamp 範囲へ収め、数値でなければ既定へ", () => {
		expect(normalizeStylePrefs({ fontSize: 1000 }).fontSize).toBe(
			MAX_FONT_SIZE,
		);
		expect(normalizeStylePrefs({ fontSize: 1 }).fontSize).toBe(MIN_FONT_SIZE);
		expect(normalizeStylePrefs({ fontSize: 40 }).fontSize).toBe(40);
		expect(normalizeStylePrefs({ fontSize: Number.NaN }).fontSize).toBe(
			DEFAULT_STYLE_PREFS.fontSize,
		);
		expect(
			normalizeStylePrefs({ fontSize: Number.POSITIVE_INFINITY }).fontSize,
		).toBe(DEFAULT_STYLE_PREFS.fontSize);
		expect(normalizeStylePrefs({ fontSize: "24" }).fontSize).toBe(
			DEFAULT_STYLE_PREFS.fontSize,
		);
	});
});

describe("stylePrefsEqual", () => {
	it("全フィールド一致で true", () => {
		const a: StylePrefs = { stroke: "#fff", dash: true, fontSize: 20 };
		expect(stylePrefsEqual(a, { ...a })).toBe(true);
	});

	it("いずれかが違えば false", () => {
		const a: StylePrefs = { stroke: "#fff", dash: true, fontSize: 20 };
		expect(stylePrefsEqual(a, { ...a, stroke: "#000" })).toBe(false);
		expect(stylePrefsEqual(a, { ...a, dash: false })).toBe(false);
		expect(stylePrefsEqual(a, { ...a, fontSize: 21 })).toBe(false);
	});
});

describe("createStylePrefsSaver", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function stubBrowser(): { set: ReturnType<typeof vi.fn> } {
		const set = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("browser", { storage: { local: { set } } });
		return { set };
	}

	it("初期値と同値の save は書き込まない", () => {
		const { set } = stubBrowser();
		const initial: StylePrefs = {
			stroke: "#fb7185",
			dash: false,
			fontSize: 24,
		};
		const saver = createStylePrefsSaver(initial);
		saver.save({ ...initial });
		expect(set).not.toHaveBeenCalled();
	});

	it("値が変わったら 1 回だけ書き込み、以降の同値はスキップする", () => {
		const { set } = stubBrowser();
		const saver = createStylePrefsSaver(DEFAULT_STYLE_PREFS);
		const changed: StylePrefs = { stroke: "#000000", dash: true, fontSize: 24 };
		saver.save(changed);
		saver.save({ ...changed });
		expect(set).toHaveBeenCalledTimes(1);
		expect(set).toHaveBeenCalledWith({ "style-prefs": changed });
	});

	it("保存前に正規化する（不正 fontSize は clamp して書き込む）", () => {
		const { set } = stubBrowser();
		const saver = createStylePrefsSaver(DEFAULT_STYLE_PREFS);
		saver.save({ stroke: "#000000", dash: false, fontSize: 9999 });
		expect(set).toHaveBeenCalledWith({
			"style-prefs": {
				stroke: "#000000",
				dash: false,
				fontSize: MAX_FONT_SIZE,
			},
		});
	});
});
