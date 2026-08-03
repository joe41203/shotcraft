import { afterEach, describe, expect, it, vi } from "vitest";
import { SPOTLIGHT_DIM_ALPHA } from "../lib/editor/spotlight";
import {
	createStylePrefsSaver,
	DEFAULT_STYLE_PREFS,
	normalizeIntensity,
	normalizeStylePrefs,
	type StylePrefs,
	stylePrefsEqual,
} from "../lib/editor/style-prefs";
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from "../lib/editor/text";

/** 全フィールドを埋めた妥当な StylePrefs（テスト用の基準値）。 */
const FULL: StylePrefs = {
	stroke: "#34d399",
	dash: true,
	fontSize: 40,
	arrowStyle: "double",
	fill: true,
	intensity: "strong",
	spotlightAlpha: 0.85,
	calloutTail: "up",
	cropRatio: "16:9",
};

describe("normalizeStylePrefs", () => {
	it("有効な値はそのまま通す", () => {
		expect(normalizeStylePrefs(FULL)).toEqual(FULL);
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

	it("fill は boolean 以外を false（塗りなし）へ落とす", () => {
		expect(normalizeStylePrefs({ fill: true }).fill).toBe(true);
		expect(normalizeStylePrefs({ fill: false }).fill).toBe(false);
		expect(normalizeStylePrefs({ fill: "true" }).fill).toBe(false);
		expect(normalizeStylePrefs({ fill: 1 }).fill).toBe(false);
	});

	it("intensity は 3 値のみ受け付け、それ以外は normal へ", () => {
		expect(normalizeStylePrefs({ intensity: "weak" }).intensity).toBe("weak");
		expect(normalizeStylePrefs({ intensity: "normal" }).intensity).toBe(
			"normal",
		);
		expect(normalizeStylePrefs({ intensity: "strong" }).intensity).toBe(
			"strong",
		);
		expect(normalizeStylePrefs({ intensity: "extreme" }).intensity).toBe(
			"normal",
		);
		expect(normalizeStylePrefs({ intensity: 5 }).intensity).toBe("normal");
	});

	it("spotlightAlpha は [0,1] へクランプし、数値でなければ既定へ", () => {
		expect(normalizeStylePrefs({ spotlightAlpha: 0.55 }).spotlightAlpha).toBe(
			0.55,
		);
		expect(normalizeStylePrefs({ spotlightAlpha: 2 }).spotlightAlpha).toBe(1);
		expect(normalizeStylePrefs({ spotlightAlpha: -1 }).spotlightAlpha).toBe(0);
		expect(
			normalizeStylePrefs({ spotlightAlpha: Number.NaN }).spotlightAlpha,
		).toBe(SPOTLIGHT_DIM_ALPHA);
		expect(normalizeStylePrefs({ spotlightAlpha: "0.7" }).spotlightAlpha).toBe(
			SPOTLIGHT_DIM_ALPHA,
		);
	});

	it("calloutTail は 4 値のみ受け付け、それ以外は down へ", () => {
		expect(normalizeStylePrefs({ calloutTail: "up" }).calloutTail).toBe("up");
		expect(normalizeStylePrefs({ calloutTail: "left" }).calloutTail).toBe(
			"left",
		);
		expect(normalizeStylePrefs({ calloutTail: "bottom" }).calloutTail).toBe(
			"down",
		);
		expect(normalizeStylePrefs({ calloutTail: 1 }).calloutTail).toBe("down");
		expect(normalizeStylePrefs({}).calloutTail).toBe("down");
	});

	it("cropRatio は 4 値のみ受け付け、それ以外は free へ", () => {
		expect(normalizeStylePrefs({ cropRatio: "1:1" }).cropRatio).toBe("1:1");
		expect(normalizeStylePrefs({ cropRatio: "16:9" }).cropRatio).toBe("16:9");
		expect(normalizeStylePrefs({ cropRatio: "2:1" }).cropRatio).toBe("free");
		expect(normalizeStylePrefs({ cropRatio: 1 }).cropRatio).toBe("free");
		expect(normalizeStylePrefs({}).cropRatio).toBe("free");
	});
});

describe("normalizeIntensity", () => {
	it("3 値はそのまま通す", () => {
		expect(normalizeIntensity("weak")).toBe("weak");
		expect(normalizeIntensity("normal")).toBe("normal");
		expect(normalizeIntensity("strong")).toBe("strong");
	});

	it("未設定・不正値は normal へ", () => {
		expect(normalizeIntensity(undefined)).toBe("normal");
		expect(normalizeIntensity(null)).toBe("normal");
		expect(normalizeIntensity("high")).toBe("normal");
		expect(normalizeIntensity(1)).toBe("normal");
	});
});

describe("stylePrefsEqual", () => {
	it("全フィールド一致で true", () => {
		expect(stylePrefsEqual(FULL, { ...FULL })).toBe(true);
	});

	it("いずれかが違えば false", () => {
		expect(stylePrefsEqual(FULL, { ...FULL, stroke: "#000" })).toBe(false);
		expect(stylePrefsEqual(FULL, { ...FULL, dash: false })).toBe(false);
		expect(stylePrefsEqual(FULL, { ...FULL, fontSize: 21 })).toBe(false);
		expect(stylePrefsEqual(FULL, { ...FULL, arrowStyle: "curved" })).toBe(
			false,
		);
		expect(stylePrefsEqual(FULL, { ...FULL, fill: false })).toBe(false);
		expect(stylePrefsEqual(FULL, { ...FULL, intensity: "weak" })).toBe(false);
		expect(stylePrefsEqual(FULL, { ...FULL, spotlightAlpha: 0.55 })).toBe(
			false,
		);
		expect(stylePrefsEqual(FULL, { ...FULL, calloutTail: "down" })).toBe(false);
		expect(stylePrefsEqual(FULL, { ...FULL, cropRatio: "free" })).toBe(false);
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
		const saver = createStylePrefsSaver(DEFAULT_STYLE_PREFS);
		saver.save({ ...DEFAULT_STYLE_PREFS });
		expect(set).not.toHaveBeenCalled();
	});

	it("値が変わったら 1 回だけ書き込み、以降の同値はスキップする", () => {
		const { set } = stubBrowser();
		const saver = createStylePrefsSaver(DEFAULT_STYLE_PREFS);
		const changed: StylePrefs = {
			stroke: "#000000",
			dash: true,
			fontSize: 24,
			arrowStyle: "double",
			fill: true,
			intensity: "strong",
			spotlightAlpha: 0.85,
			calloutTail: "left",
			cropRatio: "4:3",
		};
		saver.save(changed);
		saver.save({ ...changed });
		expect(set).toHaveBeenCalledTimes(1);
		expect(set).toHaveBeenCalledWith({ "style-prefs": changed });
	});

	it("保存前に正規化する（不正 fontSize は clamp して書き込む）", () => {
		const { set } = stubBrowser();
		const saver = createStylePrefsSaver(DEFAULT_STYLE_PREFS);
		saver.save({
			stroke: "#000000",
			dash: false,
			fontSize: 9999,
			arrowStyle: "single",
			fill: false,
			intensity: "normal",
			spotlightAlpha: SPOTLIGHT_DIM_ALPHA,
			calloutTail: "down",
			cropRatio: "free",
		});
		expect(set).toHaveBeenCalledWith({
			"style-prefs": {
				stroke: "#000000",
				dash: false,
				fontSize: MAX_FONT_SIZE,
				arrowStyle: "single",
				fill: false,
				intensity: "normal",
				spotlightAlpha: SPOTLIGHT_DIM_ALPHA,
				calloutTail: "down",
				cropRatio: "free",
			},
		});
	});
});
