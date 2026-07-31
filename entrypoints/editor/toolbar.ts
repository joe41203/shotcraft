import { icons } from "@/lib/icons";
import { FONT_CHOICES, type FontFamilyKey } from "@/lib/theme";
import type { ToolName } from "./tools/types";

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

/** 線の太さ（細/中/太）。 */
export const STROKE_WIDTHS = [
	{ value: 2, label: "細" },
	{ value: 4, label: "中" },
	{ value: 8, label: "太" },
] as const;

/**
 * テキストのフォントサイズ・プリセット（小/中/大/特大、px）。
 * 24（大）が新規テキストの既定。preview はボタンに描く「A」の見た目上の大きさ（px）。
 */
export const FONT_SIZES = [
	{ value: 14, label: "小", preview: 11 },
	{ value: 18, label: "中", preview: 14 },
	{ value: 24, label: "大", preview: 17 },
	{ value: 32, label: "特大", preview: 20 },
] as const;

/** フォント選択肢を FONT_CHOICES から並べる（rounded が先頭＝既定）。 */
const FONT_FAMILY_OPTIONS = (
	Object.entries(FONT_CHOICES) as [
		FontFamilyKey,
		(typeof FONT_CHOICES)[FontFamilyKey],
	][]
).map(([key, def]) => ({ value: key, label: def.label }));

interface ToolDef {
	name: ToolName;
	label: string;
	shortcut: string;
	icon: string;
}

const TOOLS: ToolDef[] = [
	{ name: "select", label: "選択", shortcut: "V", icon: icons.select },
	{ name: "arrow", label: "矢印", shortcut: "A", icon: icons.arrow },
	{ name: "rect", label: "矩形", shortcut: "R", icon: icons.rect },
	{ name: "ellipse", label: "楕円", shortcut: "E", icon: icons.ellipse },
	{ name: "text", label: "テキスト", shortcut: "T", icon: icons.text },
	{ name: "pen", label: "ペン", shortcut: "P", icon: icons.pen },
	{ name: "marker", label: "マーカー", shortcut: "M", icon: icons.marker },
	{ name: "mosaic", label: "モザイク", shortcut: "X", icon: icons.mosaic },
	{ name: "crop", label: "クロップ", shortcut: "C", icon: icons.crop },
];

export interface ToolbarCallbacks {
	onToolChange(tool: ToolName): void;
	onColorChange(color: string): void;
	onStrokeWidthChange(width: number): void;
	/** テキストのフォント種別（FONT_CHOICES の key）が選ばれたとき。 */
	onFontFamilyChange(family: FontFamilyKey): void;
	/** テキストのフォントサイズ（px）が選ばれたとき。 */
	onFontSizeChange(size: number): void;
	onUndo(): void;
	onRedo(): void;
	onZoomChange?(scale: number): void;
	/** PNG 保存（ダウンロード）。 */
	onSavePng(): void;
	/** クリップボードへコピー。 */
	onCopy(): void;
}

/**
 * 上部固定ツールバー。ツール 7 ボタン・色スウォッチ・線の太さ・undo/redo を持つ。
 * 状態（選択中ツール・色・太さ・undo/redo の可否・ズーム率）は set* で反映する。
 */
export class Toolbar {
	private toolButtons = new Map<ToolName, HTMLButtonElement>();
	private colorButtons = new Map<string, HTMLButtonElement>();
	private widthButtons = new Map<number, HTMLButtonElement>();
	/** テキスト向けの文脈グループ（テキストツール/テキスト選択中のみ表示）。 */
	private textGroup!: HTMLDivElement;
	private textDivider!: HTMLSpanElement;
	private fontSelect!: HTMLSelectElement;
	private fontSizeButtons = new Map<number, HTMLButtonElement>();
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
			const btn = iconButton(tool.icon, `${tool.label} (${tool.shortcut})`);
			btn.addEventListener("click", () =>
				this.callbacks.onToolChange(tool.name),
			);
			this.toolButtons.set(tool.name, btn);
			toolGroup.append(btn);
		}
		this.root.append(toolGroup, divider());

		// 色スウォッチ群
		const colorGroup = group();
		for (const color of COLORS) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "swatch";
			btn.title = color.label;
			btn.style.setProperty("--swatch", color.value);
			btn.addEventListener("click", () =>
				this.callbacks.onColorChange(color.value),
			);
			this.colorButtons.set(color.value, btn);
			colorGroup.append(btn);
		}
		this.root.append(colorGroup, divider());

		// 線の太さ群
		const widthGroup = group();
		for (const w of STROKE_WIDTHS) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "width-btn";
			btn.title = `太さ: ${w.label} (${w.value}px)`;
			const dot = document.createElement("span");
			dot.className = "width-dot";
			dot.style.width = `${w.value + 2}px`;
			dot.style.height = `${w.value + 2}px`;
			btn.append(dot);
			btn.addEventListener("click", () =>
				this.callbacks.onStrokeWidthChange(w.value),
			);
			this.widthButtons.set(w.value, btn);
			widthGroup.append(btn);
		}
		this.root.append(widthGroup, divider());

		// テキスト用グループ（フォント選択 + サイズ）。テキストツール選択中または
		// テキストシェイプ選択中のときだけ表示する（setTextControlsVisible で制御）。
		this.textGroup = group();

		this.fontSelect = document.createElement("select");
		this.fontSelect.className = "font-select";
		this.fontSelect.title = "フォント";
		this.fontSelect.setAttribute("aria-label", "フォント");
		for (const opt of FONT_FAMILY_OPTIONS) {
			const o = document.createElement("option");
			o.value = opt.value;
			o.textContent = opt.label;
			this.fontSelect.append(o);
		}
		this.fontSelect.addEventListener("change", () =>
			this.callbacks.onFontFamilyChange(this.fontSelect.value as FontFamilyKey),
		);
		this.textGroup.append(this.fontSelect);

		for (const s of FONT_SIZES) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "font-size-btn";
			btn.title = `文字サイズ: ${s.label} (${s.value}px)`;
			btn.setAttribute("aria-label", btn.title);
			const glyph = document.createElement("span");
			glyph.className = "font-size-glyph";
			glyph.textContent = "A";
			glyph.style.fontSize = `${s.preview}px`;
			btn.append(glyph);
			btn.addEventListener("click", () =>
				this.callbacks.onFontSizeChange(s.value),
			);
			this.fontSizeButtons.set(s.value, btn);
			this.textGroup.append(btn);
		}

		this.textDivider = divider();
		this.root.append(this.textGroup, this.textDivider);
		this.setTextControlsVisible(false);

		// undo/redo
		const historyGroup = group();
		this.undoButton = iconButton(icons.undo, "元に戻す (Ctrl/Cmd+Z)");
		this.undoButton.addEventListener("click", () => this.callbacks.onUndo());
		this.redoButton = iconButton(icons.redo, "やり直し (Ctrl/Cmd+Shift+Z)");
		this.redoButton.addEventListener("click", () => this.callbacks.onRedo());
		historyGroup.append(this.undoButton, this.redoButton);
		this.root.append(historyGroup, divider());

		// ズーム率表示
		this.zoomLabel = document.createElement("span");
		this.zoomLabel.className = "zoom-label";
		this.zoomLabel.title = "0 キーで全体フィット";
		this.root.append(this.zoomLabel);

		// 出力ボタンを右端へ押しやるスペーサー。
		const spacer = document.createElement("span");
		spacer.className = "toolbar-spacer";
		this.root.append(spacer);

		// 出力: コピー（通常ボタン）と PNG 保存（主要アクション）。
		const exportGroup = group();
		const copyBtn = textButton(
			icons.copy,
			"コピー",
			"クリップボードへコピー (Ctrl/Cmd+C)",
		);
		copyBtn.addEventListener("click", () => this.callbacks.onCopy());
		const saveBtn = textButton(icons.download, "PNG保存", "PNG をダウンロード");
		saveBtn.classList.add("primary");
		saveBtn.addEventListener("click", () => this.callbacks.onSavePng());
		exportGroup.append(copyBtn, saveBtn);
		this.root.append(exportGroup);
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

	setStrokeWidth(width: number): void {
		for (const [value, btn] of this.widthButtons) {
			btn.classList.toggle("active", value === width);
		}
	}

	/** フォント選択の現在値を反映する。 */
	setFontFamily(family: FontFamilyKey): void {
		this.fontSelect.value = family;
	}

	/**
	 * フォントサイズの現在値を反映する。プリセット外の値（旧データ・変形後の
	 * リサイズ結果）ではどのボタンも active にしない。
	 */
	setFontSize(size: number): void {
		for (const [value, btn] of this.fontSizeButtons) {
			btn.classList.toggle("active", value === size);
		}
	}

	/** テキスト用コントロール群（フォント・サイズ）の表示/非表示を切り替える。 */
	setTextControlsVisible(visible: boolean): void {
		this.textGroup.hidden = !visible;
		this.textDivider.hidden = !visible;
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

function iconButton(iconSvg: string, title: string): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "icon-btn";
	btn.title = title;
	btn.setAttribute("aria-label", title);
	btn.innerHTML = iconSvg;
	return btn;
}

/** SVG アイコン + テキストラベルのボタン（出力アクション用）。 */
function textButton(
	iconSvg: string,
	label: string,
	title: string,
): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "text-btn";
	btn.title = title;
	const icon = document.createElement("span");
	icon.className = "text-btn-icon";
	icon.innerHTML = iconSvg;
	const text = document.createElement("span");
	text.textContent = label;
	btn.append(icon, text);
	return btn;
}
