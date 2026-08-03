import type { ArrowStyle } from "@/lib/editor/arrow";
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

export interface ToolbarCallbacks {
	onToolChange(tool: ToolName): void;
	onColorChange(color: string): void;
	/** 線種（実線/破線）が選ばれたとき。 */
	onDashChange(dash: boolean): void;
	/** 矢印スタイル（片側 / 両側 / 曲線）が選ばれたとき。 */
	onArrowStyleChange(style: ArrowStyle): void;
	onUndo(): void;
	onRedo(): void;
	onZoomChange?(scale: number): void;
	/** PNG 保存（ダウンロード）。 */
	onSavePng(): void;
	/** クリップボードへコピー。 */
	onCopy(): void;
}

/**
 * 上部固定ツールバー。ツールボタン群・色スウォッチ・線種・undo/redo を持つ。
 * 状態（選択中ツール・色・undo/redo の可否・ズーム率）は set* で反映する。
 */
export class Toolbar {
	private toolButtons = new Map<ToolName, HTMLButtonElement>();
	private colorButtons = new Map<string, HTMLButtonElement>();
	/**
	 * 「スタイル」ボタン（線種・矢印スタイルをまとめたポップオーバーの入口）と
	 * その所属グループ・区切り。線種/矢印いずれかのセクションが必要なときだけ出す。
	 */
	private styleGroup!: HTMLDivElement;
	private styleDivider!: HTMLSpanElement;
	private styleButton!: HTMLButtonElement;
	/** ポップオーバー本体（ボタン直下に開く小パネル）。 */
	private stylePanel!: HTMLDivElement;
	private stylePanelOpen = false;
	/** 線種（実線/破線）セクションと各ボタン。ポップオーバー内に置く。 */
	private dashSection!: HTMLDivElement;
	private dashButtons = new Map<boolean, HTMLButtonElement>();
	/** 矢印スタイル（片側 / 両側 / 曲線）セクションと各ボタン。ポップオーバー内に置く。 */
	private arrowStyleSection!: HTMLDivElement;
	private arrowStyleButtons = new Map<ArrowStyle, HTMLButtonElement>();
	/** 各セクションの表示状態（両方 false ならボタン自体を隠す）。 */
	private dashSectionVisible = false;
	private arrowSectionVisible = false;
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

		// 「スタイル」ボタン + ポップオーバー。線種（実線/破線）と矢印スタイル
		// （片側/両側/曲線）を 1 つの入口にまとめる。ボタンは線種/矢印いずれかの
		// セクションが必要なときだけ出す（setDashControlsVisible /
		// setArrowStyleControlsVisible が各セクション表示を切り替え、その和集合で
		// ボタン自体の表示を決める）。位置は従来トグルがあった場所（色スウォッチの次）。
		this.buildStyleControls();

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
	}

	/**
	 * 「スタイル」ボタンとポップオーバーパネルを組み立てる。
	 * - ボタン: 調整系アイコン + aria-haspopup / aria-expanded。クリックで開閉。
	 * - パネル: 線種セクション（実線/破線）と矢印セクション（片側/両側/曲線）を縦に並べる。
	 *   各セクションの表示は setDashControlsVisible / setArrowStyleControlsVisible が制御し、
	 *   両方非表示ならボタン自体を隠す（syncStyleButtonVisibility）。
	 */
	private buildStyleControls(): void {
		this.styleGroup = group();
		// 相対配置の起点にする（パネルをボタン直下へ絶対配置するため）。
		this.styleGroup.classList.add("style-group");

		this.styleButton = iconButton(icons.style, "スタイル");
		this.styleButton.classList.add("style-btn");
		this.styleButton.setAttribute("aria-haspopup", "true");
		this.styleButton.setAttribute("aria-expanded", "false");
		this.styleButton.addEventListener("click", () => this.toggleStylePanel());

		this.stylePanel = document.createElement("div");
		this.stylePanel.className = "style-panel";
		this.stylePanel.hidden = true;
		this.stylePanel.setAttribute("role", "group");
		this.stylePanel.setAttribute("aria-label", "スタイル");

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

		this.stylePanel.append(this.dashSection, this.arrowStyleSection);
		this.styleGroup.append(this.styleButton, this.stylePanel);
		this.styleDivider = divider();
		this.root.append(this.styleGroup, this.styleDivider);

		// 表示前でも「どちらが選択中か」を確定させておく（既定は実線・片側）。
		// 実際の現在値・復元値は初期化直後の syncToolbar が反映する。
		this.setDash(false);
		this.setArrowStyle("single");
		this.setDashControlsVisible(false);
		this.setArrowStyleControlsVisible(false);
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
	 * 「スタイル」ボタン自体の表示を各セクションの表示状態の和集合で決める。
	 * 両セクションとも非表示ならボタンと区切りを隠し、開いていれば閉じる。
	 */
	private syncStyleButtonVisibility(): void {
		const visible = this.dashSectionVisible || this.arrowSectionVisible;
		this.styleGroup.hidden = !visible;
		this.styleDivider.hidden = !visible;
		if (!visible && this.stylePanelOpen) this.closeStylePanel(false);
	}

	/** 「スタイル」ポップオーバーの開閉をトグルする。 */
	private toggleStylePanel(): void {
		if (this.stylePanelOpen) this.closeStylePanel(true);
		else this.openStylePanel();
	}

	/**
	 * ポップオーバーを開く。開いたら最初の（表示中の）選択肢へフォーカスし、
	 * Esc・パネル外クリックで閉じられるようリスナを張る。ボタンのツールチップは
	 * 開いている間は抑止する（data-tooltip を退避）。
	 */
	private openStylePanel(): void {
		if (this.stylePanelOpen) return;
		this.stylePanelOpen = true;
		this.stylePanel.hidden = false;
		this.styleButton.setAttribute("aria-expanded", "true");
		// パネル表示中はボタンのツールチップを出さない（開閉と二重に出るのを避ける）。
		this.suppressedTooltip = this.styleButton.dataset.tooltip;
		delete this.styleButton.dataset.tooltip;

		// 外側クリック・Esc で閉じる。開いた直後の click 伝播で即閉じないよう次フレームで張る。
		document.addEventListener("keydown", this.onStyleKeydown, true);
		window.setTimeout(() => {
			if (this.stylePanelOpen) {
				document.addEventListener(
					"pointerdown",
					this.onOutsidePointerDown,
					true,
				);
			}
		}, 0);

		// 最初の「表示中セクションの先頭ボタン」へフォーカスする。
		this.firstStyleOption()?.focus();
	}

	/**
	 * ポップオーバーを閉じる。restoreFocus が true ならボタンへフォーカスを戻す
	 * （Esc・パネル内での確定・トグル操作など、ユーザー起点の閉じで戻す）。
	 */
	private closeStylePanel(restoreFocus: boolean): void {
		if (!this.stylePanelOpen) return;
		this.stylePanelOpen = false;
		this.stylePanel.hidden = true;
		this.styleButton.setAttribute("aria-expanded", "false");
		document.removeEventListener("keydown", this.onStyleKeydown, true);
		document.removeEventListener(
			"pointerdown",
			this.onOutsidePointerDown,
			true,
		);
		// 抑止していたツールチップ本文を戻す。
		if (this.suppressedTooltip !== undefined) {
			this.styleButton.dataset.tooltip = this.suppressedTooltip;
			this.suppressedTooltip = undefined;
		}
		if (restoreFocus) this.styleButton.focus();
	}

	/** 表示中セクションの中で最初の選択肢ボタンを返す（フォーカス初期化用）。 */
	private firstStyleOption(): HTMLButtonElement | null {
		return this.stylePanel.querySelector<HTMLButtonElement>(
			".style-section:not([hidden]) button",
		);
	}

	/** Esc でパネルを閉じる（ボタンへフォーカスを戻す）。 */
	private onStyleKeydown = (e: KeyboardEvent): void => {
		if (e.key === "Escape") {
			e.preventDefault();
			this.closeStylePanel(true);
		}
	};

	/** パネル・ボタンの外側を押したら閉じる（フォーカスは戻さない）。 */
	private onOutsidePointerDown = (e: PointerEvent): void => {
		const target = e.target;
		if (!(target instanceof Node)) return;
		if (this.styleGroup.contains(target)) return;
		this.closeStylePanel(false);
	};

	/** 開いている間に退避したボタンのツールチップ本文。 */
	private suppressedTooltip: string | undefined;

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

	/** 線種セクションの表示/非表示を切り替える（ポップオーバー内）。 */
	setDashControlsVisible(visible: boolean): void {
		this.dashSectionVisible = visible;
		this.dashSection.hidden = !visible;
		this.syncStyleButtonVisibility();
	}

	/** 矢印スタイルの現在値を反映する（active クラスと aria-pressed の両方）。 */
	setArrowStyle(style: ArrowStyle): void {
		for (const [value, btn] of this.arrowStyleButtons) {
			const on = value === style;
			btn.classList.toggle("active", on);
			btn.setAttribute("aria-pressed", String(on));
		}
	}

	/** 矢印スタイルセクションの表示/非表示を切り替える（ポップオーバー内）。 */
	setArrowStyleControlsVisible(visible: boolean): void {
		this.arrowSectionVisible = visible;
		this.arrowStyleSection.hidden = !visible;
		this.syncStyleButtonVisibility();
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
