import type { ArrowStyle } from "@/lib/editor/arrow";
import type { CalloutTail } from "@/lib/editor/callout";
import { CROP_RATIO_OPTIONS, type CropRatio } from "@/lib/editor/crop";
import type { MosaicBlurIntensity } from "@/lib/editor/doc";
import {
	isSpotlightDimPreset,
	SPOTLIGHT_DIM_OPTIONS,
} from "@/lib/editor/spotlight";
import { FONT_SIZE_OPTIONS, isFontSizePreset } from "@/lib/editor/text";
import { placeTooltip } from "@/lib/editor/tooltip";
import { icons } from "@/lib/icons";
import type { ToolName } from "./tools/types";
import { Tooltip } from "./tooltip";

/** 色スウォッチ（モダンミュート）。デフォルトはコーラル。 */
export const COLORS = [
	{ value: "#fb7185", label: "コーラル" },
	{ value: "#fbbf24", label: "アンバー" },
	{ value: "#34d399", label: "エメラルド" },
	{ value: "#38bdf8", label: "スカイ" },
	{ value: "#a78bfa", label: "バイオレット" },
	{ value: "#18181b", label: "黒" },
	{ value: "#fafafa", label: "白" },
] as const;

interface ToolDef {
	name: ToolName;
	label: string;
	shortcut: string;
	icon: string;
}

const TOOLS: ToolDef[] = [
	{ name: "select", label: "選択", shortcut: "V", icon: icons.select },
	{ name: "arrow", label: "矢印", shortcut: "A", icon: icons.arrow },
	{ name: "line", label: "直線", shortcut: "L", icon: icons.line },
	{ name: "rect", label: "矩形", shortcut: "R", icon: icons.rect },
	{ name: "ellipse", label: "楕円", shortcut: "E", icon: icons.ellipse },
	// スポットライト（暗幕）は強調系。矩形・楕円の近くに置く。
	{
		name: "spotlight",
		label: "スポットライト",
		shortcut: "O",
		icon: icons.spotlight,
	},
	{ name: "text", label: "テキスト", shortcut: "T", icon: icons.text },
	{ name: "pen", label: "ペン", shortcut: "P", icon: icons.pen },
	{ name: "marker", label: "マーカー", shortcut: "M", icon: icons.marker },
	{ name: "step", label: "ステップ", shortcut: "S", icon: icons.step },
	{ name: "callout", label: "フキダシ", shortcut: "B", icon: icons.callout },
	// 伏せ系グループ: モザイク・ぼかしを隣り合わせに置く。
	{ name: "mosaic", label: "モザイク", shortcut: "X", icon: icons.mosaic },
	{ name: "blur", label: "ぼかし", shortcut: "U", icon: icons.blur },
	{ name: "crop", label: "クロップ", shortcut: "C", icon: icons.crop },
];

/** 線種（実線/破線）の選択肢。 */
export const DASH_OPTIONS = [
	{ value: false, label: "実線" },
	{ value: true, label: "破線" },
] as const;

/** 矢印スタイル（片側 / 両側 / 曲線）の選択肢。矢印ツール選択中のみ表示する。 */
export const ARROW_STYLE_OPTIONS: {
	value: ArrowStyle;
	label: string;
	icon: string;
}[] = [
	{ value: "single", label: "片側矢印", icon: icons.arrowSingle },
	{ value: "double", label: "両側矢印", icon: icons.arrowDouble },
	{ value: "curved", label: "曲線矢印", icon: icons.arrowCurved },
];

/** 塗り（なし / 半透明）の選択肢。矩形・楕円ツール選択中（または図形選択中）に表示する。 */
export const FILL_OPTIONS = [
	{ value: false, label: "なし" },
	{ value: true, label: "半透明" },
] as const;

/** 強度（弱 / 標準 / 強）の選択肢。モザイク・ぼかしツール選択中（または図形選択中）に表示する。 */
export const INTENSITY_OPTIONS: {
	value: MosaicBlurIntensity;
	label: string;
}[] = [
	{ value: "weak", label: "弱" },
	{ value: "normal", label: "標準" },
	{ value: "strong", label: "強" },
];

/** しっぽの向き（下 / 上 / 左 / 右）の選択肢。フキダシツール選択中（または図形選択中）に表示する。 */
export const CALLOUT_TAIL_OPTIONS: { value: CalloutTail; label: string }[] = [
	{ value: "down", label: "下" },
	{ value: "up", label: "上" },
	{ value: "left", label: "左" },
	{ value: "right", label: "右" },
];

export interface ToolbarCallbacks {
	onToolChange(tool: ToolName): void;
	onColorChange(color: string): void;
	/** 線種（実線/破線）が選ばれたとき。 */
	onDashChange(dash: boolean): void;
	/** 矢印スタイル（片側 / 両側 / 曲線）が選ばれたとき。 */
	onArrowStyleChange(style: ArrowStyle): void;
	/** フォントサイズ（S/M/L）が選ばれたとき（テキスト・フキダシ）。 */
	onFontSizeChange(px: number): void;
	/** 塗り（なし/半透明）が選ばれたとき（矩形・楕円）。 */
	onFillChange(fill: boolean): void;
	/** 強度（弱/標準/強）が選ばれたとき（モザイク・ぼかし）。 */
	onIntensityChange(intensity: MosaicBlurIntensity): void;
	/** 暗さ（薄め/標準/濃いめ）が選ばれたとき（スポットライト）。値は暗幕の不透明度。 */
	onSpotlightDimChange(alpha: number): void;
	/** しっぽの向き（下/上/左/右）が選ばれたとき（フキダシ）。 */
	onCalloutTailChange(tail: CalloutTail): void;
	/** 「次を 1 に戻す」アクションが押されたとき（ステップ）。次に置くバッジの番号を 1 にする。 */
	onStepNumberReset(): void;
	/** 比率（自由/1:1/4:3/16:9）が選ばれたとき（クロップ）。 */
	onCropRatioChange(ratio: CropRatio): void;
	onUndo(): void;
	onRedo(): void;
	onZoomChange?(scale: number): void;
	/** PNG 保存（ダウンロード）。 */
	onSavePng(): void;
	/** クリップボードへコピー。 */
	onCopy(): void;
}

/**
 * 上部固定ツールバー。ツールボタン群・色スウォッチ・undo/redo を持つ。
 * 線種・矢印スタイルは、線系ツールがアクティブな間（または線系図形を選択中）に
 * そのツールボタンの真下へ固定表示するフライアウトで選ばせる。
 * 状態（選択中ツール・色・undo/redo の可否・ズーム率）は set* で反映する。
 */
export class Toolbar {
	private toolButtons = new Map<ToolName, HTMLButtonElement>();
	private colorButtons = new Map<string, HTMLButtonElement>();
	/**
	 * 線種・矢印スタイルのフライアウト本体（アンカー先ツールボタンの真下に固定表示する
	 * 小パネル）。線系ツールがアクティブな間、または線系図形を選択中に出しっぱなしにする
	 * （クリックで開くメニューではない）。中に線種セクション・矢印セクションを持つ。
	 */
	private styleFlyout!: HTMLDivElement;
	private styleCaret!: HTMLSpanElement;
	/** 線種（実線/破線）セクションと各ボタン。フライアウト内に置く。 */
	private dashSection!: HTMLDivElement;
	private dashButtons = new Map<boolean, HTMLButtonElement>();
	/** 矢印スタイル（片側 / 両側 / 曲線）セクションと各ボタン。フライアウト内に置く。 */
	private arrowStyleSection!: HTMLDivElement;
	private arrowStyleButtons = new Map<ArrowStyle, HTMLButtonElement>();
	/** サイズ（S/M/L）セクションと各ボタン（テキスト・フキダシ）。 */
	private fontSizeSection!: HTMLDivElement;
	private fontSizeButtons = new Map<number, HTMLButtonElement>();
	/** 塗り（なし/半透明）セクションと各ボタン（矩形・楕円）。 */
	private fillSection!: HTMLDivElement;
	private fillButtons = new Map<boolean, HTMLButtonElement>();
	/** 強度（弱/標準/強）セクションと各ボタン（モザイク・ぼかし）。 */
	private intensitySection!: HTMLDivElement;
	private intensityButtons = new Map<MosaicBlurIntensity, HTMLButtonElement>();
	/** 暗さ（薄め/標準/濃いめ）セクションと各ボタン（スポットライト）。 */
	private dimSection!: HTMLDivElement;
	private dimButtons = new Map<number, HTMLButtonElement>();
	/** しっぽ（下/上/左/右）セクションと各ボタン（フキダシ）。 */
	private calloutTailSection!: HTMLDivElement;
	private calloutTailButtons = new Map<CalloutTail, HTMLButtonElement>();
	/** 番号（次を1に戻す）セクション（ステップ）。トグルでなくアクションボタン 1 個。 */
	private stepNumberSection!: HTMLDivElement;
	/** 比率（自由/1:1/4:3/16:9）セクションと各ボタン（クロップ）。 */
	private cropRatioSection!: HTMLDivElement;
	private cropRatioButtons = new Map<CropRatio, HTMLButtonElement>();
	/** 各セクションの表示状態。 */
	private dashSectionVisible = false;
	private arrowSectionVisible = false;
	private fontSizeSectionVisible = false;
	private fillSectionVisible = false;
	private intensitySectionVisible = false;
	private dimSectionVisible = false;
	private calloutTailSectionVisible = false;
	private stepNumberSectionVisible = false;
	private cropRatioSectionVisible = false;
	/** フライアウトを真下に出すツールボタン名。null なら非表示。 */
	private anchorTool: ToolName | null = null;
	private undoButton!: HTMLButtonElement;
	private redoButton!: HTMLButtonElement;
	private zoomLabel!: HTMLSpanElement;

	constructor(
		private root: HTMLElement,
		private callbacks: ToolbarCallbacks,
	) {
		this.build();
	}

	private build(): void {
		this.root.classList.add("toolbar");

		// ツールボタン群
		const toolGroup = group();
		for (const tool of TOOLS) {
			const btn = iconButton(tool.icon, tool.label, tool.shortcut);
			btn.addEventListener("click", () =>
				this.callbacks.onToolChange(tool.name),
			);
			this.toolButtons.set(tool.name, btn);
			toolGroup.append(btn);
		}
		this.root.append(toolGroup, divider());

		// 線種・矢印スタイルのフライアウト。DOM 上はツールボタン群の直後に置き、
		// Tab 順が「ツール → フライアウト内のスタイルボタン」と自然に流れるようにする。
		// 位置は固定配置でアンカー先ボタンの真下に置くため、ここでの DOM 位置は
		// ツールバーのレイアウトを押し広げない（setStyleAnchor が座標を与える）。
		this.buildStyleFlyout();

		// 色スウォッチ群
		const colorGroup = group();
		// スウォッチはヒット領域を 24px に広げているため、隣接の当たり判定が
		// 重ならないよう間隔をやや広げる（.color-group で gap を上書き）。
		colorGroup.classList.add("color-group");
		for (const color of COLORS) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "swatch";
			btn.dataset.tooltip = color.label;
			btn.setAttribute("aria-label", `色: ${color.label}`);
			btn.style.setProperty("--swatch", color.value);
			btn.addEventListener("click", () =>
				this.callbacks.onColorChange(color.value),
			);
			this.colorButtons.set(color.value, btn);
			colorGroup.append(btn);
		}
		this.root.append(colorGroup, divider());

		// undo/redo
		const historyGroup = group();
		this.undoButton = iconButton(icons.undo, "元に戻す", "Ctrl/Cmd+Z");
		this.undoButton.addEventListener("click", () => this.callbacks.onUndo());
		this.redoButton = iconButton(icons.redo, "やり直し", "Ctrl/Cmd+Shift+Z");
		this.redoButton.addEventListener("click", () => this.callbacks.onRedo());
		historyGroup.append(this.undoButton, this.redoButton);
		this.root.append(historyGroup, divider());

		// ズーム率表示
		this.zoomLabel = document.createElement("span");
		this.zoomLabel.className = "zoom-label";
		this.zoomLabel.dataset.tooltip = "全体フィット";
		this.zoomLabel.dataset.shortcut = "0";
		this.root.append(this.zoomLabel);

		// 出力ボタンを右端へ押しやるスペーサー。
		const spacer = document.createElement("span");
		spacer.className = "toolbar-spacer";
		this.root.append(spacer);

		// 出力: コピー（通常ボタン）と PNG 保存（主要アクション）。
		// 誤クリック防止のため、両ボタンは他グループより広い間隔で並べる。
		const exportGroup = group();
		exportGroup.classList.add("export-group");
		const copyBtn = textButton(
			icons.copy,
			"コピー",
			"クリップボードへコピー",
			"Ctrl/Cmd+C",
		);
		copyBtn.addEventListener("click", () => this.callbacks.onCopy());
		const saveBtn = textButton(icons.download, "PNG保存", "PNG をダウンロード");
		saveBtn.classList.add("primary");
		saveBtn.addEventListener("click", () => this.callbacks.onSavePng());
		exportGroup.append(copyBtn, saveBtn);
		this.root.append(exportGroup);

		// data-tooltip を持つ全ボタンにホバー/フォーカスでツールチップを出す。
		// Tooltip はコンストラクタで root にイベントを委譲し body 直下に要素を
		// 生成するため、参照を保持しなくてもツールバーと同じ寿命で動き続ける。
		new Tooltip(this.root);

		// ウィンドウ幅が変わるとツールバーが折り返してアンカー先ボタンの位置がずれる。
		// フライアウト表示中は再配置する（固定配置なので座標を計算し直す必要がある）。
		window.addEventListener("resize", () => {
			if (this.anchorTool) this.placeFlyout();
		});
	}

	/**
	 * スタイルフライアウトパネルを組み立てる。
	 * - パネル: 各ツール共通の 1 枚。線種・矢印・サイズ・塗り・強度・暗さのセクションを
	 *   横に並べ、現在のツール/選択に応じて出すセクションだけを表示する。
	 *   role="group" + aria-label。固定配置でアンカー先ツールボタンの真下に置く。
	 * - しっぽ（caret）: 対応するボタンを指す小さな三角形。
	 * 各セクションの表示は set*ControlsVisible が制御し、アンカー先ボタンは setStyleAnchor
	 * が決める（すべて非表示・アンカー無しなら隠す）。
	 */
	private buildStyleFlyout(): void {
		this.styleFlyout = document.createElement("div");
		this.styleFlyout.className = "style-flyout";
		this.styleFlyout.hidden = true;
		this.styleFlyout.setAttribute("role", "group");
		this.styleFlyout.setAttribute("aria-label", "図形スタイル");

		// ボタンを指すしっぽ（三角）。left は placeFlyout がボタン中央に合わせる。
		this.styleCaret = document.createElement("span");
		this.styleCaret.className = "style-flyout-caret";
		this.styleFlyout.append(this.styleCaret);

		// 線種セクション。ラベル + 実線/破線の 2 択トグル（従来のアイコン・ラベルを流用）。
		const dash = this.buildStyleSection("線種");
		this.dashSection = dash.section;
		for (const opt of DASH_OPTIONS) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "dash-btn";
			btn.dataset.tooltip = opt.label;
			btn.setAttribute("aria-label", `線種: ${opt.label}`);
			// トグルとしての選択状態を明示する（初期化時に setDash が反映する）。
			btn.setAttribute("aria-pressed", "false");
			const line = document.createElement("span");
			line.className = opt.value ? "dash-line dashed" : "dash-line";
			btn.append(line);
			btn.addEventListener("click", () =>
				this.callbacks.onDashChange(opt.value),
			);
			this.dashButtons.set(opt.value, btn);
			dash.options.append(btn);
		}

		// 矢印セクション。ラベル + 片側/両側/曲線の 3 択トグル（従来のアイコン・ラベルを流用）。
		const arrow = this.buildStyleSection("矢印");
		this.arrowStyleSection = arrow.section;
		for (const opt of ARROW_STYLE_OPTIONS) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "arrow-style-btn";
			btn.dataset.tooltip = opt.label;
			btn.setAttribute("aria-label", `矢印スタイル: ${opt.label}`);
			btn.setAttribute("aria-pressed", "false");
			btn.innerHTML = opt.icon;
			btn.addEventListener("click", () =>
				this.callbacks.onArrowStyleChange(opt.value),
			);
			this.arrowStyleButtons.set(opt.value, btn);
			arrow.options.append(btn);
		}

		// サイズセクション（テキスト・フキダシ）。S/M/L のテキストラベルトグル。
		this.fontSizeSection = this.buildLabeledToggleSection(
			"サイズ",
			FONT_SIZE_OPTIONS.map((o) => ({ label: o.label, tooltip: o.label })),
			(i) => this.callbacks.onFontSizeChange(FONT_SIZE_OPTIONS[i]?.value ?? 24),
			(btn, i) => {
				const v = FONT_SIZE_OPTIONS[i]?.value;
				if (v != null) this.fontSizeButtons.set(v, btn);
			},
		);

		// 塗りセクション（矩形・楕円）。なし/半透明のテキストラベルトグル。
		this.fillSection = this.buildLabeledToggleSection(
			"塗り",
			FILL_OPTIONS.map((o) => ({ label: o.label, tooltip: o.label })),
			(i) => this.callbacks.onFillChange(FILL_OPTIONS[i]?.value ?? false),
			(btn, i) => {
				const v = FILL_OPTIONS[i]?.value;
				if (v != null) this.fillButtons.set(v, btn);
			},
		);

		// 強度セクション（モザイク・ぼかし）。弱/標準/強のテキストラベルトグル。
		this.intensitySection = this.buildLabeledToggleSection(
			"強度",
			INTENSITY_OPTIONS.map((o) => ({ label: o.label, tooltip: o.label })),
			(i) =>
				this.callbacks.onIntensityChange(
					INTENSITY_OPTIONS[i]?.value ?? "normal",
				),
			(btn, i) => {
				const v = INTENSITY_OPTIONS[i]?.value;
				if (v != null) this.intensityButtons.set(v, btn);
			},
		);

		// 暗さセクション（スポットライト）。薄め/標準/濃いめのテキストラベルトグル。
		this.dimSection = this.buildLabeledToggleSection(
			"暗さ",
			SPOTLIGHT_DIM_OPTIONS.map((o) => ({ label: o.label, tooltip: o.label })),
			(i) =>
				this.callbacks.onSpotlightDimChange(
					SPOTLIGHT_DIM_OPTIONS[i]?.value ?? 0.7,
				),
			(btn, i) => {
				const v = SPOTLIGHT_DIM_OPTIONS[i]?.value;
				if (v != null) this.dimButtons.set(v, btn);
			},
		);

		// しっぽセクション（フキダシ）。下/上/左/右のテキストラベルトグル。
		this.calloutTailSection = this.buildLabeledToggleSection(
			"しっぽ",
			CALLOUT_TAIL_OPTIONS.map((o) => ({ label: o.label, tooltip: o.label })),
			(i) =>
				this.callbacks.onCalloutTailChange(
					CALLOUT_TAIL_OPTIONS[i]?.value ?? "down",
				),
			(btn, i) => {
				const v = CALLOUT_TAIL_OPTIONS[i]?.value;
				if (v != null) this.calloutTailButtons.set(v, btn);
			},
		);

		// 番号セクション（ステップ）。トグルでなく「次を 1 に戻す」アクションボタン 1 個。
		this.stepNumberSection = this.buildActionSection("番号", [
			{
				label: "次を1に戻す",
				tooltip: "次に置くステップ番号を 1 にする",
				onClick: () => this.callbacks.onStepNumberReset(),
			},
		]);

		// 比率セクション（クロップ）。自由/1:1/4:3/16:9 のテキストラベルトグル。
		this.cropRatioSection = this.buildLabeledToggleSection(
			"比率",
			CROP_RATIO_OPTIONS.map((o) => ({ label: o.label, tooltip: o.label })),
			(i) =>
				this.callbacks.onCropRatioChange(
					CROP_RATIO_OPTIONS[i]?.value ?? "free",
				),
			(btn, i) => {
				const v = CROP_RATIO_OPTIONS[i]?.value;
				if (v != null) this.cropRatioButtons.set(v, btn);
			},
		);

		this.styleFlyout.append(
			this.dashSection,
			this.arrowStyleSection,
			this.fontSizeSection,
			this.fillSection,
			this.intensitySection,
			this.dimSection,
			this.calloutTailSection,
			this.stepNumberSection,
			this.cropRatioSection,
		);
		this.root.append(this.styleFlyout);

		// 表示前でも「どれが選択中か」を確定させておく（既定は実線・片側・M・塗りなし・
		// 標準強度・標準の暗さ）。実際の現在値・復元値は初期化直後の syncToolbar が反映する。
		this.setDash(false);
		this.setArrowStyle("single");
	}

	/**
	 * ラベル付きのスタイルセクション（見出し + 選択肢を横並び）の骨組みを作る。
	 * section は表示切替（.hidden）用、options は選択肢ボタンの append 先。
	 */
	private buildStyleSection(label: string): {
		section: HTMLDivElement;
		options: HTMLDivElement;
	} {
		const section = document.createElement("div");
		section.className = "style-section";
		const heading = document.createElement("span");
		heading.className = "style-section-label";
		heading.textContent = label;
		const options = document.createElement("div");
		options.className = "style-section-options";
		section.append(heading, options);
		return { section, options };
	}

	/**
	 * テキストラベル式トグルボタンのセクション（サイズ・塗り・強度・暗さ）を組み立てる。
	 * dash・矢印セクションと同じ骨組み（buildStylesection）に、共通の見た目
	 * （.style-toggle-btn）でラベル文字を載せたボタンを並べる。aria-pressed でトグルの
	 * 選択状態を表す（現在値の反映は各 set* 系メソッドが担う）。
	 *
	 * @param label 見出し（"サイズ" 等）
	 * @param options 各ボタンの表示ラベルとツールチップ本文
	 * @param onClick i 番目のボタンがクリックされたとき呼ぶ
	 * @param register i 番目のボタン要素を各 Map へ登録するコールバック
	 */
	private buildLabeledToggleSection(
		label: string,
		options: { label: string; tooltip: string }[],
		onClick: (index: number) => void,
		register: (btn: HTMLButtonElement, index: number) => void,
	): HTMLDivElement {
		const { section, options: optionsEl } = this.buildStyleSection(label);
		options.forEach((opt, i) => {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "style-toggle-btn";
			btn.dataset.tooltip = opt.tooltip;
			btn.setAttribute("aria-label", `${label}: ${opt.tooltip}`);
			btn.setAttribute("aria-pressed", "false");
			btn.textContent = opt.label;
			btn.addEventListener("click", () => onClick(i));
			register(btn, i);
			optionsEl.append(btn);
		});
		return section;
	}

	/**
	 * アクションボタン式のセクション（見出し + 押すたびに動作するボタン）を組み立てる。
	 * トグル（aria-pressed）ではなく通常ボタンとして扱う（ステップの「次を1に戻す」用）。
	 * 選択状態を持たないので active/aria-pressed は付けず、押すたびに onClick が走る。
	 */
	private buildActionSection(
		label: string,
		actions: { label: string; tooltip: string; onClick: () => void }[],
	): HTMLDivElement {
		const { section, options: optionsEl } = this.buildStyleSection(label);
		for (const action of actions) {
			const btn = document.createElement("button");
			btn.type = "button";
			// トグルと同じ見た目のクラスを流用しつつ、選択状態は持たせない。
			btn.className = "style-toggle-btn";
			btn.dataset.tooltip = action.tooltip;
			btn.setAttribute("aria-label", `${label}: ${action.tooltip}`);
			btn.textContent = action.label;
			btn.addEventListener("click", action.onClick);
			optionsEl.append(btn);
		}
		return section;
	}

	/**
	 * トグルボタン群の現在値を反映する共通ヘルパ（active クラス + aria-pressed）。
	 * value に一致するキーのボタンだけ on にする。value がどのキーとも一致しないとき
	 * （プリセット外の連続値など）はすべて off になる。
	 */
	private setToggleActive<K>(
		buttons: Map<K, HTMLButtonElement>,
		matches: (key: K) => boolean,
	): void {
		for (const [key, btn] of buttons) {
			const on = matches(key);
			btn.classList.toggle("active", on);
			btn.setAttribute("aria-pressed", String(on));
		}
	}

	/**
	 * フライアウトを真下に出すツールボタンを設定する（null・未知のツール名で非表示）。
	 * app 側が styleAnchorToolFor で決めた結果（ツール名文字列 or null）を渡す。
	 * アンカーが決まっていてかつ表示すべきセクションがあるときだけ出す（無ければ隠す）。
	 */
	setStyleAnchor(tool: string | null): void {
		// ツールボタンが実在する名前だけをアンカーに採る（未知の名前は非表示扱い）。
		this.anchorTool =
			tool != null && this.toolButtons.has(tool as ToolName)
				? (tool as ToolName)
				: null;
		this.syncFlyoutVisibility();
	}

	/**
	 * フライアウトの表示可否と位置を同期する。アンカー先ボタンがあり、かつ
	 * いずれかのセクションが表示対象のときだけ出して真下へ配置する。
	 */
	private syncFlyoutVisibility(): void {
		const hasSection =
			this.dashSectionVisible ||
			this.arrowSectionVisible ||
			this.fontSizeSectionVisible ||
			this.fillSectionVisible ||
			this.intensitySectionVisible ||
			this.dimSectionVisible ||
			this.calloutTailSectionVisible ||
			this.stepNumberSectionVisible ||
			this.cropRatioSectionVisible;
		const visible = this.anchorTool != null && hasSection;
		this.styleFlyout.hidden = !visible;
		if (visible) this.placeFlyout();
	}

	/**
	 * フライアウトをアンカー先ツールボタンの真下・中央揃えに固定配置する。
	 * 画面端でのはみ出しは placeTooltip（純粋関数）でクランプし、しっぽ（caret）は
	 * ボタン中央を指し続けるよう補正する。ツールチップと同じ配置ロジックを共有する。
	 */
	private placeFlyout(): void {
		if (!this.anchorTool) return;
		const button = this.toolButtons.get(this.anchorTool);
		if (!button) return;
		const rect = button.getBoundingClientRect();
		const { left, top, caretLeft } = placeTooltip({
			targetLeft: rect.left,
			targetRight: rect.right,
			targetBottom: rect.bottom,
			tooltipWidth: this.styleFlyout.offsetWidth,
			viewportWidth: window.innerWidth,
		});
		this.styleFlyout.style.left = `${left}px`;
		this.styleFlyout.style.top = `${top}px`;
		this.styleCaret.style.left = `${caretLeft}px`;
	}

	setTool(tool: ToolName): void {
		for (const [name, btn] of this.toolButtons) {
			btn.classList.toggle("active", name === tool);
		}
	}

	setColor(color: string): void {
		for (const [value, btn] of this.colorButtons) {
			btn.classList.toggle("active", value === color);
		}
	}

	/** 線種（実線/破線）の現在値を反映する（active クラスと aria-pressed の両方）。 */
	setDash(dash: boolean): void {
		for (const [value, btn] of this.dashButtons) {
			const on = value === dash;
			btn.classList.toggle("active", on);
			btn.setAttribute("aria-pressed", String(on));
		}
	}

	/** 線種セクションの表示/非表示を切り替える（フライアウト内）。 */
	setDashControlsVisible(visible: boolean): void {
		this.dashSectionVisible = visible;
		this.dashSection.hidden = !visible;
		this.syncFlyoutVisibility();
	}

	/** 矢印スタイルの現在値を反映する（active クラスと aria-pressed の両方）。 */
	setArrowStyle(style: ArrowStyle): void {
		for (const [value, btn] of this.arrowStyleButtons) {
			const on = value === style;
			btn.classList.toggle("active", on);
			btn.setAttribute("aria-pressed", String(on));
		}
	}

	/** 矢印スタイルセクションの表示/非表示を切り替える（フライアウト内）。 */
	setArrowStyleControlsVisible(visible: boolean): void {
		this.arrowSectionVisible = visible;
		this.arrowStyleSection.hidden = !visible;
		this.syncFlyoutVisibility();
	}

	/**
	 * サイズ（S/M/L）の現在値を反映する。size がプリセット（S/M/L のどれか）に一致する
	 * ボタンだけ on にする。プリセット外（ハンドルドラッグで変えた連続値）ならどのボタンも
	 * active にしない（isFontSizePreset で一括判定してから設定する）。
	 */
	setFontSize(size: number): void {
		const preset = isFontSizePreset(size);
		this.setToggleActive(this.fontSizeButtons, (v) => preset && v === size);
	}

	/** サイズセクションの表示/非表示を切り替える（フライアウト内）。 */
	setFontSizeControlsVisible(visible: boolean): void {
		this.fontSizeSectionVisible = visible;
		this.fontSizeSection.hidden = !visible;
		this.syncFlyoutVisibility();
	}

	/** 塗り（なし/半透明）の現在値を反映する。 */
	setFill(fill: boolean): void {
		this.setToggleActive(this.fillButtons, (v) => v === fill);
	}

	/** 塗りセクションの表示/非表示を切り替える（フライアウト内）。 */
	setFillControlsVisible(visible: boolean): void {
		this.fillSectionVisible = visible;
		this.fillSection.hidden = !visible;
		this.syncFlyoutVisibility();
	}

	/** 強度（弱/標準/強）の現在値を反映する。 */
	setIntensity(intensity: MosaicBlurIntensity): void {
		this.setToggleActive(this.intensityButtons, (v) => v === intensity);
	}

	/** 強度セクションの表示/非表示を切り替える（フライアウト内）。 */
	setIntensityControlsVisible(visible: boolean): void {
		this.intensitySectionVisible = visible;
		this.intensitySection.hidden = !visible;
		this.syncFlyoutVisibility();
	}

	/**
	 * 暗さ（薄め/標準/濃いめ）の現在値を反映する。alpha がプリセット（3 値のどれか）に
	 * 一致するボタンだけ on にする。プリセット外ならどのボタンも active にしない
	 * （isSpotlightDimPreset で一括判定）。
	 */
	setSpotlightDim(alpha: number): void {
		const preset = isSpotlightDimPreset(alpha);
		this.setToggleActive(this.dimButtons, (v) => preset && v === alpha);
	}

	/** 暗さセクションの表示/非表示を切り替える（フライアウト内）。 */
	setSpotlightDimControlsVisible(visible: boolean): void {
		this.dimSectionVisible = visible;
		this.dimSection.hidden = !visible;
		this.syncFlyoutVisibility();
	}

	/** しっぽ（下/上/左/右）の現在値を反映する（active クラスと aria-pressed）。 */
	setCalloutTail(tail: CalloutTail): void {
		this.setToggleActive(this.calloutTailButtons, (v) => v === tail);
	}

	/** しっぽセクションの表示/非表示を切り替える（フライアウト内）。 */
	setCalloutTailControlsVisible(visible: boolean): void {
		this.calloutTailSectionVisible = visible;
		this.calloutTailSection.hidden = !visible;
		this.syncFlyoutVisibility();
	}

	/**
	 * 番号（次を1に戻す）セクションの表示/非表示を切り替える（フライアウト内）。
	 * アクションボタンなので現在値の反映（set*）は無い。
	 */
	setStepNumberControlsVisible(visible: boolean): void {
		this.stepNumberSectionVisible = visible;
		this.stepNumberSection.hidden = !visible;
		this.syncFlyoutVisibility();
	}

	/** 比率（自由/1:1/4:3/16:9）の現在値を反映する（active クラスと aria-pressed）。 */
	setCropRatio(ratio: CropRatio): void {
		this.setToggleActive(this.cropRatioButtons, (v) => v === ratio);
	}

	/** 比率セクションの表示/非表示を切り替える（フライアウト内）。 */
	setCropRatioControlsVisible(visible: boolean): void {
		this.cropRatioSectionVisible = visible;
		this.cropRatioSection.hidden = !visible;
		this.syncFlyoutVisibility();
	}

	setUndoRedo(canUndo: boolean, canRedo: boolean): void {
		this.undoButton.disabled = !canUndo;
		this.redoButton.disabled = !canRedo;
	}

	setZoom(scale: number): void {
		this.zoomLabel.textContent = `${Math.round(scale * 100)}%`;
	}
}

function group(): HTMLDivElement {
	const el = document.createElement("div");
	el.className = "tool-group";
	return el;
}

function divider(): HTMLSpanElement {
	const el = document.createElement("span");
	el.className = "divider";
	return el;
}

/**
 * アイコンのみのボタン。ツールチップ本文（tooltip）と任意のショートカット
 * （shortcut）を data 属性に載せ、ブラウザ標準の title は使わない
 * （カスタムツールチップと二重に出るのを避ける）。aria-label は本文と
 * ショートカットを合わせた説明にする（アイコンのみなので必須）。
 */
function iconButton(
	iconSvg: string,
	tooltip: string,
	shortcut?: string,
): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "icon-btn";
	btn.dataset.tooltip = tooltip;
	if (shortcut) btn.dataset.shortcut = shortcut;
	btn.setAttribute("aria-label", ariaLabel(tooltip, shortcut));
	btn.innerHTML = iconSvg;
	return btn;
}

/** SVG アイコン + テキストラベルのボタン（出力アクション用）。 */
function textButton(
	iconSvg: string,
	label: string,
	tooltip: string,
	shortcut?: string,
): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.dataset.tooltip = tooltip;
	if (shortcut) btn.dataset.shortcut = shortcut;
	btn.setAttribute("aria-label", ariaLabel(tooltip, shortcut));
	btn.className = "text-btn";
	const icon = document.createElement("span");
	icon.className = "text-btn-icon";
	icon.innerHTML = iconSvg;
	const text = document.createElement("span");
	text.textContent = label;
	btn.append(icon, text);
	return btn;
}

/** ツールチップ本文とショートカットを 1 本の aria-label 文にまとめる。 */
function ariaLabel(tooltip: string, shortcut?: string): string {
	return shortcut ? `${tooltip} (${shortcut})` : tooltip;
}
