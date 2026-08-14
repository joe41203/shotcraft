import { describe, expect, it } from "vitest";
import {
	BORDER_DEFAULT_COLOR,
	BORDER_DEFAULT_WIDTH,
	BORDER_MAX_WIDTH,
	BORDER_METRICS,
	BORDER_TEXT_MAX_LENGTH,
	borderClipRect,
	borderContentOffset,
	borderContentCornerRadii,
	borderContentRect,
	borderedSize,
	borderEqual,
	borderForPrefs,
	borderInsets,
	borderKindOf,
	borderOfKind,
	borderStrokeRect,
	borderTitleBarLayout,
	displayUrl,
	normalizeBorder,
	resolveBorder,
} from "../lib/editor/border";
import type { CropRect } from "../lib/editor/doc";

const IMAGE = { width: 800, height: 600 };
const CROP: CropRect = { x: 100, y: 50, width: 400, height: 300 };
const SIMPLE = { kind: "simple", width: 10, color: "#71717a" } as const;

describe("normalizeBorder", () => {
	it("simple はそのまま通す", () => {
		expect(normalizeBorder(SIMPLE)).toEqual(SIMPLE);
	});

	// 0.6.x で保存された doc / style-prefs は kind を持たない `{width, color}` 形式。
	it("kind の無い旧データは simple として読む（後方互換）", () => {
		expect(normalizeBorder({ width: 6, color: "#fb7185" })).toEqual({
			kind: "simple",
			width: 6,
			color: "#fb7185",
		});
	});

	it("null / undefined / 非オブジェクトはフチなし", () => {
		expect(normalizeBorder(null)).toBeNull();
		expect(normalizeBorder(undefined)).toBeNull();
		expect(normalizeBorder(6)).toBeNull();
		expect(normalizeBorder("thick")).toBeNull();
	});

	it("未知の kind はフチなしへ落とす", () => {
		expect(normalizeBorder({ kind: "neon" })).toBeNull();
	});

	describe("simple", () => {
		it("width が 0 以下ならフチなし", () => {
			expect(normalizeBorder({ kind: "simple", width: 0 })).toBeNull();
			expect(normalizeBorder({ kind: "simple", width: -4 })).toBeNull();
		});

		it("width が数値でない・NaN・無限大ならフチなし", () => {
			expect(normalizeBorder({ kind: "simple", width: "6" })).toBeNull();
			expect(normalizeBorder({ kind: "simple", width: Number.NaN })).toBeNull();
			expect(
				normalizeBorder({
					kind: "simple",
					width: Number.POSITIVE_INFINITY,
				}),
			).toBeNull();
		});

		it("width は整数へ丸め、上限でクランプする", () => {
			const round = normalizeBorder({ kind: "simple", width: 6.6 });
			expect(round?.kind === "simple" && round.width).toBe(7);
			const clamped = normalizeBorder({ kind: "simple", width: 10_000 });
			expect(clamped?.kind === "simple" && clamped.width).toBe(
				BORDER_MAX_WIDTH,
			);
		});

		it("color が文字列でない・空なら既定色へフォールバックする", () => {
			const b = normalizeBorder({ kind: "simple", width: 6 });
			expect(b?.kind === "simple" && b.color).toBe(BORDER_DEFAULT_COLOR);
			const b2 = normalizeBorder({ kind: "simple", width: 6, color: "" });
			expect(b2?.kind === "simple" && b2.color).toBe(BORDER_DEFAULT_COLOR);
		});
	});

	describe("browser / dark のテキスト", () => {
		it("url / title はそのまま通す", () => {
			expect(
				normalizeBorder({ kind: "browser", url: "https://a.example" }),
			).toEqual({ kind: "browser", url: "https://a.example" });
			expect(normalizeBorder({ kind: "dark", title: "app.ts" })).toEqual({
				kind: "dark",
				title: "app.ts",
			});
		});

		it("文字列でない・未設定は空文字にする", () => {
			expect(normalizeBorder({ kind: "browser" })).toEqual({
				kind: "browser",
				url: "",
			});
			expect(normalizeBorder({ kind: "dark", title: 42 })).toEqual({
				kind: "dark",
				title: "",
			});
		});

		it("極端に長い文字列は上限で切り詰める", () => {
			const long = "x".repeat(BORDER_TEXT_MAX_LENGTH + 50);
			const b = normalizeBorder({ kind: "browser", url: long });
			expect(b?.kind === "browser" && b.url.length).toBe(
				BORDER_TEXT_MAX_LENGTH,
			);
		});
	});

	// 廃止した種類（card / tape）の保存値が残っていてもフチなしとして安全に読める。
	it("廃止された種類はフチなしへ落とす", () => {
		expect(normalizeBorder({ kind: "card" })).toBeNull();
		expect(normalizeBorder({ kind: "tape" })).toBeNull();
	});
});

describe("resolveBorder / borderKindOf", () => {
	it("未設定の doc（旧データ）はフチなしとして解決する", () => {
		expect(resolveBorder(undefined)).toBeNull();
		expect(borderKindOf(undefined)).toBe("none");
		expect(borderKindOf(null)).toBe("none");
	});

	it("設定済みなら種類を返す", () => {
		expect(borderKindOf(SIMPLE)).toBe("simple");
		expect(borderKindOf({ kind: "browser", url: "" })).toBe("browser");
	});
});

describe("borderForPrefs", () => {
	// 設定は次のキャプチャに引き継がれるため、その画像固有の内容（撮影元 URL・
	// ページタイトル）を残すと、別のページを撮ったときに前の画像の URL が
	// 表示されてしまう（内容の取り違え・URL の意図しない露出）。
	it("ブラウザ風の URL は保存対象から外す（前の画像の URL を持ち越さない）", () => {
		expect(
			borderForPrefs({ kind: "browser", url: "https://internal.example/secret" }),
		).toEqual({ kind: "browser", url: "" });
	});

	it("ダークウィンドウのタイトルも保存対象から外す", () => {
		expect(borderForPrefs({ kind: "dark", title: "社外秘の資料" })).toEqual({
			kind: "dark",
			title: "",
		});
	});

	it("種類そのものは残す（次に開いた画像も同じフレームで始まる）", () => {
		expect(borderForPrefs({ kind: "browser", url: "https://a.example" })?.kind).toBe(
			"browser",
		);
	});

	it("枠線は画像固有の内容を持たないのでそのまま残す", () => {
		expect(borderForPrefs(SIMPLE)).toEqual(SIMPLE);
	});

	it("フチなしは null のまま", () => {
		expect(borderForPrefs(null)).toBeNull();
		expect(borderForPrefs(undefined)).toBeNull();
	});
});

describe("borderOfKind", () => {
	it("種類だけからフチ設定を作る（simple は既定の太さ・色）", () => {
		expect(borderOfKind("simple")).toEqual({
			kind: "simple",
			width: BORDER_DEFAULT_WIDTH,
			color: BORDER_DEFAULT_COLOR,
		});
		expect(borderOfKind("none")).toBeNull();
	});

	it("simple は太さ・色を指定できる", () => {
		expect(borderOfKind("simple", { width: 2, color: "#fb7185" })).toEqual({
			kind: "simple",
			width: 2,
			color: "#fb7185",
		});
	});

	it("browser は URL を受け取る（未指定は空文字）", () => {
		expect(borderOfKind("browser", { url: "https://a.example" })).toEqual({
			kind: "browser",
			url: "https://a.example",
		});
		expect(borderOfKind("browser")).toEqual({ kind: "browser", url: "" });
	});
});

describe("borderEqual", () => {
	it("null 同士・同値の組を同値と見なす", () => {
		expect(borderEqual(null, null)).toBe(true);
		expect(borderEqual({ ...SIMPLE }, { ...SIMPLE })).toBe(true);
	});

	it("種類が違えば false", () => {
		expect(borderEqual(SIMPLE, { kind: "browser", url: "" })).toBe(false);
		expect(borderEqual(null, { kind: "browser", url: "" })).toBe(false);
	});

	it("同じ種類でも中身が違えば false", () => {
		expect(borderEqual(SIMPLE, { ...SIMPLE, width: 2 })).toBe(false);
		expect(borderEqual(SIMPLE, { ...SIMPLE, color: "#000" })).toBe(false);
		expect(
			borderEqual(
				{ kind: "browser", url: "https://a.example" },
				{ kind: "browser", url: "https://b.example" },
			),
		).toBe(false);
	});
});

describe("displayUrl", () => {
	it("クエリ文字列とハッシュを落とす（トークン等を出さない）", () => {
		expect(displayUrl("https://example.com/page?token=secret#frag")).toBe(
			"https://example.com/page",
		);
	});

	it("オリジンのみの URL は末尾スラッシュを付けない", () => {
		expect(displayUrl("https://example.com/")).toBe("https://example.com");
		expect(displayUrl("https://example.com")).toBe("https://example.com");
	});

	it("末尾のスラッシュを落とす", () => {
		expect(displayUrl("https://example.com/docs/")).toBe(
			"https://example.com/docs",
		);
	});

	it("URL としてパースできない文字列はそのまま返す（手入力を尊重）", () => {
		expect(displayUrl("社内ダッシュボード")).toBe("社内ダッシュボード");
	});

	it("空文字・空白のみは空文字", () => {
		expect(displayUrl("")).toBe("");
		expect(displayUrl("   ")).toBe("");
	});
});

describe("borderInsets", () => {
	it("フチなしは全辺 0", () => {
		expect(borderInsets(null)).toEqual({
			top: 0,
			right: 0,
			bottom: 0,
			left: 0,
		});
	});

	it("simple は 4 辺とも同じ太さ", () => {
		expect(borderInsets(SIMPLE)).toEqual({
			top: 10,
			right: 10,
			bottom: 10,
			left: 10,
		});
	});

	it("ブラウザ風は上辺だけ厚い（クロムの高さ）", () => {
		const i = borderInsets({ kind: "browser", url: "" });
		expect(i.top).toBe(BORDER_METRICS.browser.top);
		expect(i.left).toBe(BORDER_METRICS.browser.side);
		expect(i.top).toBeGreaterThan(i.bottom);
	});

	it("ダークウィンドウ風も上辺だけ厚い（タイトルバーの高さ）", () => {
		const i = borderInsets({ kind: "dark", title: "" });
		expect(i.top).toBe(BORDER_METRICS.dark.top);
		expect(i.top).toBeGreaterThan(i.bottom);
	});
});

describe("borderedSize", () => {
	it("フチなしのときは croppedSize と一致する（従来互換）", () => {
		expect(borderedSize(null, IMAGE, null)).toEqual(IMAGE);
		expect(borderedSize(CROP, IMAGE, null)).toEqual({
			width: 400,
			height: 300,
		});
	});

	it("simple はクロップ寸法に各辺の太さを足す", () => {
		expect(borderedSize(CROP, IMAGE, SIMPLE)).toEqual({
			width: 420,
			height: 320,
		});
	});

	it("辺ごとに厚みが違う種類も 4 辺の余白どおりに広がる", () => {
		const border = { kind: "browser", url: "" } as const;
		const i = borderInsets(border);
		expect(borderedSize(null, IMAGE, border)).toEqual({
			width: IMAGE.width + i.left + i.right,
			height: IMAGE.height + i.top + i.bottom,
		});
	});
});

describe("borderContentOffset", () => {
	it("フチなしでは従来どおり crop 分だけのオフセット", () => {
		expect(borderContentOffset(null, null)).toEqual({ x: 0, y: 0 });
		expect(borderContentOffset(CROP, null)).toEqual({ x: -100, y: -50 });
	});

	it("上辺・左辺の余白だけ内側へ寄せる", () => {
		expect(borderContentOffset(null, SIMPLE)).toEqual({ x: 10, y: 10 });
		expect(borderContentOffset(CROP, SIMPLE)).toEqual({ x: -90, y: -40 });
	});

	it("ブラウザ風は上辺の余白が厚いぶん下へ寄る", () => {
		const border = { kind: "browser", url: "" } as const;
		expect(borderContentOffset(null, border)).toEqual({
			x: BORDER_METRICS.browser.side,
			y: BORDER_METRICS.browser.top,
		});
	});
});

describe("borderClipRect", () => {
	it("クロップなしでは画像全体", () => {
		expect(borderClipRect(null, IMAGE)).toEqual({
			x: 0,
			y: 0,
			width: 800,
			height: 600,
		});
	});

	// Konva の clip はレイヤーの position を適用する前（レイヤーローカル座標）で
	// 効くので、オフセット後の 0,0 起点ではなく crop の座標そのものを返す。
	it("クロップありでは crop の座標そのもの（0,0 起点にしない）", () => {
		expect(borderClipRect(CROP, IMAGE)).toEqual({
			x: 100,
			y: 50,
			width: 400,
			height: 300,
		});
	});
});

describe("borderContentRect", () => {
	it("コンテンツ領域はステージ座標で余白の内側に置かれる", () => {
		expect(borderContentRect(CROP, IMAGE, SIMPLE)).toEqual({
			x: 10,
			y: 10,
			width: 400,
			height: 300,
		});
	});

	it("フチなしでは原点から画像全体", () => {
		expect(borderContentRect(null, IMAGE, null)).toEqual({
			x: 0,
			y: 0,
			width: 800,
			height: 600,
		});
	});
});

describe("borderContentCornerRadii", () => {
	it("角丸のない種類・フチなしは全隅 0", () => {
		expect(borderContentCornerRadii(null)).toEqual([0, 0, 0, 0]);
		expect(borderContentCornerRadii(SIMPLE)).toEqual([0, 0, 0, 0]);
	});

	it("ブラウザ・ダークは下側 2 隅だけ丸める（上辺はバーと接する）", () => {
		const browser = borderContentCornerRadii({ kind: "browser", url: "" });
		expect(browser[0]).toBe(0);
		expect(browser[1]).toBe(0);
		expect(browser[2]).toBeGreaterThan(0);
		expect(browser[3]).toBe(browser[2]);

		const dark = borderContentCornerRadii({ kind: "dark", title: "" });
		expect(dark[0]).toBe(0);
		expect(dark[2]).toBeGreaterThan(0);
	});
});

describe("borderStrokeRect", () => {
	it("simple 以外・フチなしでは null（この関数の対象外）", () => {
		expect(borderStrokeRect(null, IMAGE, null)).toBeNull();
		expect(
			borderStrokeRect(null, IMAGE, { kind: "browser", url: "" }),
		).toBeNull();
	});

	it("ストロークが中心基準なので太さの半分だけ内側に矩形を置く", () => {
		expect(borderStrokeRect(null, IMAGE, SIMPLE)).toEqual({
			x: 5,
			y: 5,
			width: 810,
			height: 610,
			strokeWidth: 10,
			color: "#71717a",
		});
	});

	it("枠はステージ外周にぴったり収まる（はみ出さない・内側に余らない）", () => {
		const border = { kind: "simple", width: 12, color: "#000" } as const;
		const outer = borderedSize(CROP, IMAGE, border);
		const rect = borderStrokeRect(CROP, IMAGE, border);
		if (!rect) throw new Error("simple なら矩形が返るはず");

		// ストロークの外端 = 矩形の端 ± 太さの半分。これがステージの端と一致する。
		expect(rect.x - rect.strokeWidth / 2).toBe(0);
		expect(rect.y - rect.strokeWidth / 2).toBe(0);
		expect(rect.x + rect.width + rect.strokeWidth / 2).toBe(outer.width);
		expect(rect.y + rect.height + rect.strokeWidth / 2).toBe(outer.height);
	});
});

describe("borderTitleBarLayout", () => {
	it("対象外の種類・フチなしでは null", () => {
		expect(borderTitleBarLayout(null, IMAGE, null)).toBeNull();
		expect(borderTitleBarLayout(null, IMAGE, SIMPLE)).toBeNull();
	});

	it("バーは上辺の余白いっぱいで、信号機は 3 つ", () => {
		const layout = borderTitleBarLayout(null, IMAGE, {
			kind: "browser",
			url: "",
		});
		if (!layout) throw new Error("browser ならレイアウトが返るはず");
		expect(layout.bar.height).toBe(BORDER_METRICS.browser.top);
		expect(layout.bar.width).toBe(
			borderedSize(null, IMAGE, { kind: "browser", url: "" }).width,
		);
		expect(layout.dots).toHaveLength(3);
	});

	it("信号機は等間隔で、テキスト領域はその右側に置かれる", () => {
		const layout = borderTitleBarLayout(null, IMAGE, {
			kind: "browser",
			url: "",
		});
		if (!layout) throw new Error("browser ならレイアウトが返るはず");
		const [a, b, c] = layout.dots;
		if (!a || !b || !c) throw new Error("信号機は 3 つ返るはず");
		expect(b.x - a.x).toBe(c.x - b.x);
		expect(layout.text.x).toBeGreaterThan(c.x + c.radius);
		// テキストはバーの中に収まる。
		expect(layout.text.x + layout.text.width).toBeLessThanOrEqual(
			layout.bar.width,
		);
		expect(layout.text.height).toBeLessThan(layout.bar.height);
	});

	it("細い画像でもテキスト幅が負にならない", () => {
		const layout = borderTitleBarLayout(
			null,
			{ width: 40, height: 40 },
			{ kind: "browser", url: "" },
		);
		if (!layout) throw new Error("browser ならレイアウトが返るはず");
		expect(layout.text.width).toBeGreaterThanOrEqual(0);
	});
});
