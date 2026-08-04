import Konva from "konva";
import {
	CALLOUT_CORNER_RADIUS,
	CALLOUT_DEFAULT_HEIGHT,
	CALLOUT_DEFAULT_WIDTH,
	CALLOUT_FILL_ALPHA,
	CALLOUT_PADDING,
	calloutInnerWidth,
	hexToRgba,
} from "@/lib/editor/callout";
import {
	addShape,
	type CalloutShape,
	findShape,
	removeShape,
	type Shape,
	updateShape,
} from "@/lib/editor/doc";
import { CALLOUT_LINE_HEIGHT } from "@/lib/editor/text";
import { normalizeRect } from "@/lib/geometry";
import { theme } from "@/lib/theme";
import type { Point } from "../geometry-view";
import { openTextOverlay } from "./text-overlay";
import type { EditorContext, Tool, ToolName } from "./types";

/** ドラッグ確定サイズがこれ未満なら既定サイズのフキダシにする（クリックだけでも作れる）。 */
const MIN_DRAG = 8;

/**
 * コールアウト（フキダシ）注釈ツール。
 * ドラッグで本体（角丸長方形）のサイズを決め、離すとテキスト編集に入る。
 * ドラッグが極小（ほぼクリック）なら既定サイズのフキダシを置く。
 * 空のまま確定・キャンセルした新規フキダシは doc に追加しない（空図形を残さない）。
 * 既存フキダシはダブルクリックでテキストを再編集できる。
 */
export class CalloutTool implements Tool {
	readonly name: ToolName = "callout";

	private start: Point | null = null;
	private preview: Konva.Rect | null = null;
	private editing = false;

	constructor(private ctx: EditorContext) {}

	onPointerDown(pos: Point): void {
		if (this.editing) return; // 編集中は blur 確定を優先
		this.start = pos;
		this.preview = new Konva.Rect({
			x: pos.x,
			y: pos.y,
			width: 0,
			height: 0,
			cornerRadius: CALLOUT_CORNER_RADIUS,
			fill: hexToRgba(this.ctx.style.stroke, CALLOUT_FILL_ALPHA),
			stroke: this.ctx.style.stroke,
			strokeWidth: this.ctx.style.strokeWidth,
		});
		this.ctx.previewLayer.add(this.preview);
		this.ctx.previewLayer.batchDraw();
	}

	onPointerMove(pos: Point): void {
		if (!this.start || !this.preview) return;
		const r = normalizeRect(this.start.x, this.start.y, pos.x, pos.y);
		this.preview.setAttrs(r);
		this.ctx.previewLayer.batchDraw();
	}

	onPointerUp(pos: Point): void {
		if (!this.start) return;
		const start = this.start;
		this.start = null;
		this.clearPreview();

		const r = normalizeRect(start.x, start.y, pos.x, pos.y);
		// ドラッグが極小なら既定サイズを始点基準で置く。
		const width = r.width < MIN_DRAG ? CALLOUT_DEFAULT_WIDTH : r.width;
		const height = r.height < MIN_DRAG ? CALLOUT_DEFAULT_HEIGHT : r.height;
		const x = r.width < MIN_DRAG ? start.x : r.x;
		const y = r.height < MIN_DRAG ? start.y : r.y;

		const shape: CalloutShape = {
			id: this.ctx.newId(),
			type: "callout",
			x,
			y,
			width,
			height,
			text: "",
			fontSize: this.ctx.style.fontSize,
			// 新規フキダシのしっぽは現在のスタイル既定（フライアウトで選んだ値）。
			// tails は配列をコピーして持たせる（style 側の配列と共有しない）。
			tails: [...this.ctx.style.calloutTails],
			stroke: this.ctx.style.stroke,
			strokeWidth: this.ctx.style.strokeWidth,
			rotation: 0,
			opacity: 1,
		};
		this.openEditor(shape, "new");
	}

	onDblClick(shape: Shape): void {
		if (shape.type !== "callout") return;
		if (this.editing) return;
		this.openEditor(shape, "existing");
	}

	deactivate(): void {
		this.clearPreview();
		this.start = null;
	}

	/**
	 * 本体内にテキスト編集オーバーレイを開く。
	 * new: 確定でテキストがあれば addShape、無ければ何もしない。
	 * existing: 元図形を隠して編集し、確定で updateShape（空なら削除）。
	 */
	private openEditor(shape: CalloutShape, mode: "new" | "existing"): void {
		this.editing = true;
		if (mode === "existing") this.ctx.setNodeVisible(shape.id, false);

		openTextOverlay(
			this.ctx,
			{
				value: shape.text,
				docPos: { x: shape.x + CALLOUT_PADDING, y: shape.y + CALLOUT_PADDING },
				fontSize: shape.fontSize,
				fontFamily: theme.fontAnnotation,
				color: shape.stroke,
				lineHeight: CALLOUT_LINE_HEIGHT,
				wrapWidth: calloutInnerWidth(shape.width, CALLOUT_PADDING),
			},
			(text) => {
				this.editing = false;
				this.finish(shape, mode, text);
			},
		);
	}

	/** オーバーレイ確定/キャンセルの結果を doc に反映する。 */
	private finish(
		shape: CalloutShape,
		mode: "new" | "existing",
		text: string | null,
	): void {
		const trimmedEmpty = text == null || text.trim().length === 0;

		if (mode === "new") {
			if (!trimmedEmpty) {
				this.ctx.commitDoc(
					addShape(this.ctx.getDoc(), { ...shape, text: text as string }),
				);
			}
			return;
		}

		// mode === "existing"
		const exists = findShape(this.ctx.getDoc(), shape.id);
		if (!exists) return;
		if (text == null) {
			// キャンセル: 元ノードを再表示するだけ。
			this.ctx.setNodeVisible(shape.id, true);
		} else if (trimmedEmpty) {
			// 空にした確定は図形削除。
			this.ctx.commitDoc(removeShape(this.ctx.getDoc(), shape.id));
		} else {
			this.ctx.commitDoc(updateShape(this.ctx.getDoc(), shape.id, { text }));
		}
	}

	private clearPreview(): void {
		if (this.preview) {
			this.preview.destroy();
			this.preview = null;
			this.ctx.previewLayer.batchDraw();
		}
	}
}
