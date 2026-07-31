import { icons } from "@/lib/icons";
import type { ToolName } from "./tools/types";

/** 色スウォッチ。デフォルトは赤。 */
export const COLORS = [
	{ value: "#ef4444", label: "赤" },
	{ value: "#f97316", label: "オレンジ" },
	{ value: "#22c55e", label: "緑" },
	{ value: "#3b82f6", label: "青" },
	{ value: "#18181b", label: "黒" },
	{ value: "#fafafa", label: "白" },
] as const;

/** 線の太さ（細/中/太）。 */
export const STROKE_WIDTHS = [
	{ value: 2, label: "細" },
	{ value: 4, label: "中" },
	{ value: 8, label: "太" },
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
