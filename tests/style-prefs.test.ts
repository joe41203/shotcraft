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
	calloutTails: ["down", "up"],
	cropRatio: "16:9",
	exportFormat: "jpeg",
	exportQuality: "high",
	border: { kind: "simple", width: 6, color: "#71717a" },
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

	it("calloutTails は 4 値の部分集合を正規化し、空配列も許容する", () => {
		expect(
			normalizeStylePrefs({ calloutTails: ["up", "left"] }).calloutTails,
		).toEqual(["up", "left"]);
		// 重複除去・不正値除去・並び順（下→上→左→右）に整える。
		expect(
			normalizeStylePrefs({ calloutTails: ["right", "right", "bogus", "down"] })
				.calloutTails,
		).toEqual(["down", "right"]);
		// 空配列＝しっぽなしはそのまま通す（既定 ["down"] へ落とさない）。
		expect(normalizeStylePrefs({ calloutTails: [] }).calloutTails).toEqual([]);
	});

	it("calloutTails 未設定なら旧 calloutTail（単一文字列）から変換する", () => {
		expect(normalizeStylePrefs({ calloutTail: "up" }).calloutTails).toEqual([
			"up",
		]);
		expect(normalizeStylePrefs({ calloutTail: "bottom" }).calloutTails).toEqual(
			["down"],
		);
		// tails・tail とも未設定なら従来互換の ["down"]。
		expect(normalizeStylePrefs({}).calloutTails).toEqual(["down"]);
	});

	it("旧 calloutBubble キーが残っていても無視して読み込む（雲形機能は撤去済み）", () => {
		// 旧バージョンで保存された calloutBubble は正規化結果に含めない。
		const prefs = normalizeStylePrefs({ calloutBubble: "cloud" });
		expect(prefs).not.toHaveProperty("calloutBubble");
		expect(prefs).toEqual(DEFAULT_STYLE_PREFS);
	});

	it("exportFormat は 3 値のみ受け付け、それ以外は png へ", () => {
		expect(normalizeStylePrefs({ exportFormat: "jpeg" }).exportFormat).toBe(
			"jpeg",
		);
		expect(normalizeStylePrefs({ exportFormat: "webp" }).exportFormat).toBe(
			"webp",
		);
		expect(normalizeStylePrefs({ exportFormat: "gif" }).exportFormat).toBe(
			"png",
		);
		expect(normalizeStylePrefs({}).exportFormat).toBe("png");
	});

	it("exportQuality は 3 値のみ受け付け、それ以外は normal へ", () => {
		expect(normalizeStylePrefs({ exportQuality: "high" }).exportQuality).toBe(
			"high",
		);
		expect(normalizeStylePrefs({ exportQuality: "low" }).exportQuality).toBe(
			"low",
		);
		expect(normalizeStylePrefs({ exportQuality: "ultra" }).exportQuality).toBe(
			"normal",
		);
		expect(normalizeStylePrefs({}).exportQuality).toBe("normal");
	});

	it("cropRatio は 4 値のみ受け付け、それ以外は free へ", () => {
		expect(normalizeStylePrefs({ cropRatio: "1:1" }).cropRatio).toBe("1:1");
		expect(normalizeStylePrefs({ cropRatio: "16:9" }).cropRatio).toBe("16:9");
		expect(normalizeStylePrefs({ cropRatio: "2:1" }).cropRatio).toBe("free");
		expect(normalizeStylePrefs({ cropRatio: 1 }).cropRatio).toBe("free");
		expect(normalizeStylePrefs({}).cropRatio).toBe("free");
	});

	it("border は有効なフレーム設定のみ受け付け、それ以外は null（フチなし）へ", () => {
		expect(
			normalizeStylePrefs({
				border: { kind: "simple", width: 6, color: "#fb7185" },
			}).border,
		).toEqual({ kind: "simple", width: 6, color: "#fb7185" });
		expect(
			normalizeStylePrefs({ border: { kind: "browser", url: "" } }).border,
		).toEqual({ kind: "browser", url: "" });
		// 太さ 0 以下・不正値・未知や廃止された種類・未設定はすべてフチなし。
		expect(
			normalizeStylePrefs({ border: { kind: "simple", width: 0 } }).border,
		).toBeNull();
		expect(normalizeStylePrefs({ border: { kind: "neon" } }).border).toBeNull();
		expect(normalizeStylePrefs({ border: { kind: "card" } }).border).toBeNull();
		expect(normalizeStylePrefs({ border: "thick" }).border).toBeNull();
		expect(normalizeStylePrefs({}).border).toBeNull();
	});

	// 0.6.x で storage.local に保存された値は kind を持たない `{width, color}` 形式。
	it("kind の無い旧保存値は simple として読む（後方互換）", () => {
		expect(
			normalizeStylePrefs({ border: { width: 6, color: "#fb7185" } }).border,
		).toEqual({ kind: "simple", width: 6, color: "#fb7185" });
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
		expect(stylePrefsEqual(FULL, { ...FULL, calloutTails: ["down"] })).toBe(
			false,
		);
		// 集合が同じでも要素数が違えば false（部分集合の変化を拾う）。
		expect(stylePrefsEqual(FULL, { ...FULL, calloutTails: [] })).toBe(false);
		expect(stylePrefsEqual(FULL, { ...FULL, cropRatio: "free" })).toBe(false);
		expect(stylePrefsEqual(FULL, { ...FULL, exportFormat: "png" })).toBe(false);
		expect(stylePrefsEqual(FULL, { ...FULL, exportQuality: "low" })).toBe(
			false,
		);
		expect(stylePrefsEqual(FULL, { ...FULL, border: null })).toBe(false);
		expect(
			stylePrefsEqual(FULL, {
				...FULL,
				border: { kind: "simple", width: 12, color: "#71717a" },
			}),
		).toBe(false);
	});

	it("border は null 同士・同値の組を同値と見なす", () => {
		expect(
			stylePrefsEqual({ ...FULL, border: null }, { ...FULL, border: null }),
		).toBe(true);
		expect(
			stylePrefsEqual(
				{ ...FULL, border: { kind: "simple", width: 6, color: "#71717a" } },
				{ ...FULL, border: { kind: "simple", width: 6, color: "#71717a" } },
			),
		).toBe(true);
	});

	it("calloutTails は要素が同じなら順序が正規化済み前提で true", () => {
		expect(
			stylePrefsEqual(
				{ ...FULL, calloutTails: ["down", "up"] },
				{ ...FULL, calloutTails: ["down", "up"] },
			),
		).toBe(true);
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
			calloutTails: ["left"],
			cropRatio: "4:3",
			exportFormat: "webp",
			exportQuality: "low",
			border: { kind: "simple", width: 12, color: "#18181b" },
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
			calloutTails: ["down"],
			cropRatio: "free",
			exportFormat: "png",
			exportQuality: "normal",
			border: null,
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
				calloutTails: ["down"],
				cropRatio: "free",
				exportFormat: "png",
				exportQuality: "normal",
				border: null,
			},
		});
	});
});
