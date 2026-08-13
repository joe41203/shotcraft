/**
 * 画像全体を囲むフチ（外枠・装飾フレーム）の純粋な計算。
 *
 * フチは図形ではなく「画像単位の設定」なので doc.border に単一フィールドで持つ
 * （spotlightAlpha と同型）。描き方は**外側方式**で、クロップ後のコンテンツの外側に
 * 枠を足すため、出力寸法は種類ごとの余白（インセット）分だけ広がる。
 *
 * 種類は判別可能ユニオン（simple / browser / dark）。辺ごとに余白が異なる
 * （ブラウザ風は上部バーのぶん上が厚い）ので、寸法計算はすべて borderInsets
 * （4 辺の余白）を起点にする。
 *
 * ここには DOM 非依存の計算だけを置く（Konva 描画は entrypoints/editor 側）。
 */

import type { Size } from "../messages";
import { croppedSize } from "./crop";
import type { BorderKind, BorderStyle, CropRect } from "./doc";

// 型の正は doc.ts（doc に載るデータなので）。ここからも取れるよう再エクスポートする
// （利用側が border.ts だけ import すれば済むように）。
export type {
	BorderKind,
	BorderStyle,
	BrowserBorder,
	DarkWindowBorder,
	SimpleBorder,
} from "./doc";

/** 4 辺の余白（コンテンツの外側に足す px）。 */
export interface BorderInsets {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

/** フチの種類の選択肢（フライアウトの「フレーム」セクションの並び）。 */
export const BORDER_KIND_OPTIONS: {
	value: BorderKind | "none";
	label: string;
}[] = [
	{ value: "none", label: "なし" },
	{ value: "simple", label: "枠線" },
	{ value: "browser", label: "ブラウザ" },
	{ value: "dark", label: "ダーク" },
];

/** 単色枠の太さプリセット（「枠線」を選んだときだけ出す）。 */
export const BORDER_WIDTH_OPTIONS: { value: number; label: string }[] = [
	{ value: 2, label: "細" },
	{ value: 6, label: "標準" },
	{ value: 12, label: "太" },
];

/** 既定のフチ色（画面の白背景でも暗背景でも境界が分かるニュートラルなグレー）。 */
export const BORDER_DEFAULT_COLOR = "#71717a";

/** 既定の枠線の太さ（「標準」）。 */
export const BORDER_DEFAULT_WIDTH = 6;

/** 太さとして許容する上限（元画像座標系の px）。極端な値で出力が破綻しないようにする。 */
export const BORDER_MAX_WIDTH = 200;

/** アドレスバー・タイトルに入れる文字列の上限（極端に長い URL で描画が壊れないように）。 */
export const BORDER_TEXT_MAX_LENGTH = 300;

/** BORDER_WIDTH_OPTIONS の値の集合（プリセット一致判定に使う）。 */
const BORDER_WIDTH_VALUES: ReadonlySet<number> = new Set(
	BORDER_WIDTH_OPTIONS.map((o) => o.value),
);

/** 与えられた太さがプリセット（細/標準/太）のいずれかか。 */
export function isBorderWidthPreset(width: number): boolean {
	return BORDER_WIDTH_VALUES.has(width);
}

/**
 * 装飾フレームの寸法トークン（元画像座標系の px）。デザインの正はここ。
 * 色などの見た目トークンは描画側（render.ts の BORDER_THEME）が持つ。
 */
export const BORDER_METRICS = {
	/** ブラウザ風: 上部クロムの高さ・左右下の縁・角丸。 */
	browser: { top: 38, side: 1, bottom: 1, radius: 10 },
	/** ダークウィンドウ風: タイトルバーの高さ・左右下の縁・角丸。 */
	dark: { top: 34, side: 1, bottom: 1, radius: 10 },
} as const;

/** 種類ごとの 4 辺の余白を返す。フチなしは全辺 0。 */
export function borderInsets(border?: BorderStyle | null): BorderInsets {
	const b = resolveBorder(border);
	if (!b) return { top: 0, right: 0, bottom: 0, left: 0 };

	switch (b.kind) {
		case "simple":
			return { top: b.width, right: b.width, bottom: b.width, left: b.width };
		case "browser": {
			const m = BORDER_METRICS.browser;
			return { top: m.top, right: m.side, bottom: m.bottom, left: m.side };
		}
		case "dark": {
			const m = BORDER_METRICS.dark;
			return { top: m.top, right: m.side, bottom: m.bottom, left: m.side };
		}
	}
}

/** 表示用の文字列（URL・タイトル）を安全な長さ・型に整える。 */
function normalizeBorderText(raw: unknown): string {
	if (typeof raw !== "string") return "";
	return raw.slice(0, BORDER_TEXT_MAX_LENGTH);
}

/**
 * URL を表示用に短くする純粋関数。クエリ文字列とハッシュを落とし、
 * `オリジン + パス` だけにする（クエリにトークン・セッション ID が乗ることがあるため、
 * 装飾目的では既定で落とす）。パースできない文字列はそのまま返す（手入力を尊重）。
 * 末尾の `/` は 1 文字だけのときを除いて落とす。
 */
export function displayUrl(raw: string): string {
	const text = normalizeBorderText(raw).trim();
	if (!text) return "";
	try {
		const u = new URL(text);
		const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
		return `${u.origin}${path}`;
	} catch {
		return text;
	}
}

/**
 * 任意の値を BorderStyle | null へ正規化する純粋関数。
 * - null / undefined / 非オブジェクトは null（フチなし）。
 * - kind が無い旧データ（`{ width, color }`）は "simple" として読む（後方互換）。
 * - simple: width が数値でない・0 以下なら null（フチなし）。整数へ丸め上限クランプ。
 *   color が文字列でなければ既定色。
 * - browser / dark: 文字列でない url・title は空文字。長すぎる文字列は切り詰める。
 * - 未知の kind は null（フチなし）へ落とす。
 * 壊れた保存値・旧 doc を安全に読み込むための唯一の検証入口。
 */
export function normalizeBorder(raw: unknown): BorderStyle | null {
	if (raw == null || typeof raw !== "object") return null;
	const source = raw as {
		kind?: unknown;
		width?: unknown;
		color?: unknown;
		url?: unknown;
		title?: unknown;
	};

	// kind 未設定の旧データは単色枠として読む（0.6.x で保存された doc・style-prefs）。
	const kind = typeof source.kind === "string" ? source.kind : "simple";

	switch (kind) {
		case "simple": {
			const rawWidth = source.width;
			if (typeof rawWidth !== "number" || !Number.isFinite(rawWidth)) {
				return null;
			}
			const width = Math.min(BORDER_MAX_WIDTH, Math.round(rawWidth));
			// 0 以下（「なし」を含む）はフチ無しとして扱い、doc には持たせない。
			if (width <= 0) return null;
			const color =
				typeof source.color === "string" && source.color
					? source.color
					: BORDER_DEFAULT_COLOR;
			return { kind: "simple", width, color };
		}
		case "browser":
			return { kind: "browser", url: normalizeBorderText(source.url) };
		case "dark":
			return { kind: "dark", title: normalizeBorderText(source.title) };
		default:
			return null;
	}
}

/**
 * doc.border（省略可）から実際に描くフチを解決する純粋関数。
 * 未設定・不正値はフチなし（null）。読み込み側はここを通してから描画する。
 */
export function resolveBorder(border?: BorderStyle | null): BorderStyle | null {
	return normalizeBorder(border);
}

/**
 * 2 つのフチ設定が同値か（null 同士も同値）。設定変更時の no-op 判定・
 * style-prefs の過剰な書き込み抑止に使う。
 */
export function borderEqual(
	a: BorderStyle | null,
	b: BorderStyle | null,
): boolean {
	if (a == null || b == null) return a == null && b == null;
	if (a.kind !== b.kind) return false;
	switch (a.kind) {
		case "simple":
			return (
				a.width === (b as typeof a).width && a.color === (b as typeof a).color
			);
		case "browser":
			return a.url === (b as typeof a).url;
		case "dark":
			return a.title === (b as typeof a).title;
		default:
			return true;
	}
}

/**
 * 種類だけを保持したフチ設定を作る（style-prefs から復元するとき・種類を切り替える
 * ときに使う）。browser の url は呼び出し側が撮影元 URL を入れる（既定は空）。
 */
export function borderOfKind(
	kind: BorderKind | "none",
	options: {
		width?: number;
		color?: string;
		url?: string;
		title?: string;
	} = {},
): BorderStyle | null {
	switch (kind) {
		case "simple":
			return {
				kind: "simple",
				width: options.width ?? BORDER_DEFAULT_WIDTH,
				color: options.color ?? BORDER_DEFAULT_COLOR,
			};
		case "browser":
			return { kind: "browser", url: normalizeBorderText(options.url) };
		case "dark":
			return { kind: "dark", title: normalizeBorderText(options.title) };
		default:
			return null;
	}
}

/**
 * 設定として記憶してよい形へ落とす純粋関数（style-prefs 保存用）。
 *
 * ブラウザ風の URL・ダークウィンドウのタイトルは**その画像固有の内容**なので、
 * 保存すると前の画像の URL が次のキャプチャに写り込む（内容の取り違え・URL の
 * 意図しない露出）。種類と単色枠の見た目だけを残し、文字列は空にして保存する。
 */
export function borderForPrefs(
	border?: BorderStyle | null,
): BorderStyle | null {
	const b = resolveBorder(border);
	if (!b) return null;
	switch (b.kind) {
		case "browser":
			return { kind: "browser", url: "" };
		case "dark":
			return { kind: "dark", title: "" };
		default:
			return b;
	}
}

/** 現在のフチの種類（フチなしは "none"）。フライアウトの選択状態に使う。 */
export function borderKindOf(border?: BorderStyle | null): BorderKind | "none" {
	return resolveBorder(border)?.kind ?? "none";
}

/**
 * 表示・エクスポートの基準サイズ（クロップ適用後の寸法に 4 辺の余白を足したもの）。
 * フチなしなら croppedSize と一致する（＝従来どおり）。
 */
export function borderedSize(
	crop: CropRect | null,
	imageSize: Size,
	border?: BorderStyle | null,
): Size {
	const inner = croppedSize(crop, imageSize);
	const i = borderInsets(border);
	return {
		width: inner.width + i.left + i.right,
		height: inner.height + i.top + i.bottom,
	};
}

/**
 * コンテンツ（ベース画像・図形）を描くときのレイヤーオフセット。
 * クロップ分だけ原点をずらしたうえで、上辺・左辺の余白だけ内側へ寄せる。
 * これによりステージの外周に余白ができ、そこへフレームを描ける。
 */
export function borderContentOffset(
	crop: CropRect | null,
	border?: BorderStyle | null,
): { x: number; y: number } {
	const i = borderInsets(border);
	return { x: -(crop?.x ?? 0) + i.left, y: -(crop?.y ?? 0) + i.top };
}

/**
 * コンテンツ領域（フレームの内側）のクリップ矩形。
 *
 * Konva の clip はレイヤーの position を適用する**前**（レイヤーローカル座標）で
 * 効くため、crop の座標そのものを渡す必要がある（オフセット後の 0,0 起点ではない）。
 * クロップが無い場合は画像全体。
 */
export function borderClipRect(
	crop: CropRect | null,
	imageSize: Size,
): { x: number; y: number; width: number; height: number } {
	if (crop) {
		return {
			x: crop.x,
			y: crop.y,
			width: crop.width,
			height: crop.height,
		};
	}
	return { x: 0, y: 0, width: imageSize.width, height: imageSize.height };
}

/**
 * コンテンツ領域の角を丸める半径（px）。フレームの外側が角丸の種類（ブラウザ・ダーク・
 * では、中のコンテンツも同じ曲率で丸めないと角がはみ出て見える。
 *
 * ブラウザ・ダークは**下側 2 隅だけ**丸める（上辺はタイトルバーと接するので直角のまま）。
 * カードは 4 隅とも丸める。角丸のない種類（枠線・テープ）と フチなしは全隅 0。
 * 戻り値は Konva の cornerRadius と同じ [左上, 右上, 右下, 左下] の順。
 */
export function borderContentCornerRadii(
	border?: BorderStyle | null,
): [number, number, number, number] {
	const b = resolveBorder(border);
	if (!b) return [0, 0, 0, 0];
	switch (b.kind) {
		case "browser": {
			// 外枠の角丸から縁の太さを引いた分が、内側の見た目上の曲率になる。
			const r = Math.max(
				0,
				BORDER_METRICS.browser.radius - BORDER_METRICS.browser.side,
			);
			return [0, 0, r, r];
		}
		case "dark": {
			const r = Math.max(
				0,
				BORDER_METRICS.dark.radius - BORDER_METRICS.dark.side,
			);
			return [0, 0, r, r];
		}
		default:
			return [0, 0, 0, 0];
	}
}

/**
 * コンテンツ領域（フレームの内側）のステージ座標での矩形。
 * フレーム描画（角丸のクリップ・カードの影・テープの位置決め）が基準にする。
 */
export function borderContentRect(
	crop: CropRect | null,
	imageSize: Size,
	border?: BorderStyle | null,
): { x: number; y: number; width: number; height: number } {
	const inner = croppedSize(crop, imageSize);
	const i = borderInsets(border);
	return { x: i.left, y: i.top, width: inner.width, height: inner.height };
}

/**
 * 単色枠（simple）の枠そのものを描くための矩形（ステージ座標系）とストローク幅。
 *
 * Konva のストロークは線の中心を基準に内外へ半分ずつ伸びるので、太さ w の枠を
 * ステージ外周にぴったり収めるには、矩形を w/2 だけ内側へ入れて描く。
 * simple 以外・フチなしのときは null（この関数の対象外）。
 */
export function borderStrokeRect(
	crop: CropRect | null,
	imageSize: Size,
	border?: BorderStyle | null,
): {
	x: number;
	y: number;
	width: number;
	height: number;
	strokeWidth: number;
	color: string;
} | null {
	const resolved = resolveBorder(border);
	if (resolved?.kind !== "simple") return null;

	const outer = borderedSize(crop, imageSize, resolved);
	const half = resolved.width / 2;
	return {
		x: half,
		y: half,
		width: outer.width - resolved.width,
		height: outer.height - resolved.width,
		strokeWidth: resolved.width,
		color: resolved.color,
	};
}

/**
 * ブラウザ風・ダークウィンドウ風の上部バーの中身の配置（ステージ座標系）を返す。
 *
 * 信号機ボタン（3 つの円）の中心座標と半径、テキスト（URL / タイトル）を置く矩形を
 * 決める。ボタンは左端から等間隔、テキストはボタンの右側に残った幅いっぱいに取る
 * （ブラウザ風はアドレスバーの角丸プレート、ダークは中央寄せのタイトル）。
 * 対象外の種類・フチなしのときは null。
 */
export function borderTitleBarLayout(
	crop: CropRect | null,
	imageSize: Size,
	border?: BorderStyle | null,
): {
	/** バー全体（ステージ座標）。 */
	bar: { x: number; y: number; width: number; height: number };
	/** 信号機ボタンの中心と半径。 */
	dots: { x: number; y: number; radius: number }[];
	/** テキストを置く矩形（アドレスバーのプレート、またはタイトルの領域）。 */
	text: { x: number; y: number; width: number; height: number };
} | null {
	const resolved = resolveBorder(border);
	if (resolved?.kind !== "browser" && resolved?.kind !== "dark") return null;

	const outer = borderedSize(crop, imageSize, resolved);
	const insets = borderInsets(resolved);
	const bar = { x: 0, y: 0, width: outer.width, height: insets.top };

	// 信号機ボタン: バーの高さから比率で決め、左端から等間隔に置く。
	const radius = Math.max(3, Math.round(bar.height * 0.16));
	const gap = radius * 3;
	const firstX = Math.max(radius * 2, Math.round(bar.height * 0.5));
	const cy = Math.round(bar.height / 2);
	const dots = [0, 1, 2].map((i) => ({
		x: firstX + gap * i,
		y: cy,
		radius,
	}));

	// テキスト領域: 最後のボタンの右から、右端に同じだけ余白を残した幅。
	const dotsRight = firstX + gap * 2 + radius;
	const padding = Math.round(bar.height * 0.35);
	const textX = dotsRight + padding;
	const textWidth = Math.max(0, bar.width - textX - firstX);
	const textHeight = Math.max(0, Math.round(bar.height * 0.62));
	const textY = Math.round((bar.height - textHeight) / 2);

	return {
		bar,
		dots,
		text: { x: textX, y: textY, width: textWidth, height: textHeight },
	};
}
