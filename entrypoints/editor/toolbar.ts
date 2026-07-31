import { icons } from "@/lib/icons";
import { Tooltip } from "./tooltip";
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
	{ name: "step", label: "ステップ", shortcut: "S", icon: icons.step },
	{ name: "callout", label: "フキダシ", shortcut: "B", icon: icons.callout },
	{ name: "mosaic", label: "モザイク", shortcut: "X", icon: icons.mosaic },
	{ name: "crop", label: "クロップ", shortcut: "C", icon: icons.crop },
];

/** 線種（実線/破線）の選択肢。 */
export const DASH_OPTIONS = [
	{ value: false, label: "実線" },
	{ value: true, label: "破線" },
] as const;

export interface ToolbarCallbacks {
	onToolChange(tool: ToolName): void;
	onColorChange(color: string): void;
	/** 線種（実線/破線）が選ばれたとき。 */
	onDashChange(dash: boolean): void;
	onUndo(): void;
	onRedo(): void;
	onZoomChange?(scale: number): void;
	/** PNG 保存（ダウンロード）。 */
	onSavePng(): void;
	/** クリップボードへコピー。 */
	onCopy(): void;
}

/**
 * 上部固定ツールバー。ツール 7 ボタン・色スウォッチ・線種・undo/redo を持つ。
 * 状態（選択中ツール・色・undo/redo の可否・ズーム率）は set* で反映する。
 */
export class Toolbar {
	private toolButtons = new Map<ToolName, HTMLButtonElement>();
	private colorButtons = new Map<string, HTMLButtonElement>();
	/** 線種（実線/破線）の文脈グループと各ボタン。 */
	private dashGroup!: HTMLDivElement;
	private dashDivider!: HTMLSpanElement;
	private dashButtons = new Map<boolean, HTMLButtonElement>();
	private undoButton!: HTMLButtonElement;
	private redoButton!: HTMLButtonElement;
	private zoomLabel!: HTMLSpanElement;
	/** ツールバー全体に委譲するカスタムツールチップ。 */
	private tooltip!: Tooltip;

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

		// 線種（実線/破線）群。線・輪郭を持つツール/図形（矢印・矩形・楕円・ペン）の
		// ときだけ表示する（setDashControlsVisible で制御）。
		this.dashGroup = group();
		for (const opt of DASH_OPTIONS) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "dash-btn";
			btn.dataset.tooltip = opt.label;
			btn.setAttribute("aria-label", `線種: ${opt.label}`);
			const line = document.createElement("span");
			line.className = opt.value ? "dash-line dashed" : "dash-line";
			btn.append(line);
			btn.addEventListener("click", () =>
				this.callbacks.onDashChange(opt.value),
			);
			this.dashButtons.set(opt.value, btn);
			this.dashGroup.append(btn);
		}
		this.dashDivider = divider();
		this.root.append(this.dashGroup, this.dashDivider);
		this.setDashControlsVisible(false);

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
		const exportGroup = group();
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
		this.tooltip = new Tooltip(this.root);
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

	/** 線種（実線/破線）の現在値を反映する。 */
	setDash(dash: boolean): void {
		for (const [value, btn] of this.dashButtons) {
			btn.classList.toggle("active", value === dash);
		}
	}

	/** 線種コントロール群の表示/非表示を切り替える。 */
	setDashControlsVisible(visible: boolean): void {
		this.dashGroup.hidden = !visible;
		this.dashDivider.hidden = !visible;
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
