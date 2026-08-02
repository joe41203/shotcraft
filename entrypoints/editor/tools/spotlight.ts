import type Konva from "konva";
import { addShape, type SpotlightShape } from "@/lib/editor/doc";
import { normalizeRect } from "@/lib/geometry";
import type { Point } from "../geometry-view";
import { buildSpotlightVeil } from "../render";
import type { EditorContext, Tool, ToolName } from "./types";

/**
 * スポットライト（暗幕）ツール。ドラッグで矩形を描くと、その領域以外の画像全体が
 * 暗くなり、選んだ領域だけが明るく残る（視線誘導）。ドラッグ中は実際の暗幕を
 * プレビュー表示し、確定後は doc の全 spotlight をまとめて 1 枚の暗幕として
 * render.ts が描く。矩形と同じドラッグ操作だが回転は不可（モザイクと同様）。
 *
 * プレビューの暗幕は穴の位置を後から書き換えにくい（cache 済み Group）ため、
 * DragTool の「単一ノードを updatePreview で使い回す」方式には乗せず、Tool を
 * 直接実装して move のたびに暗幕 Group を作り直す。
 */
export class SpotlightTool implements Tool {
	readonly name: ToolName = "spotlight";
	/** これ未満のドラッグ距離は図形を作らず破棄する（矩形系ツールと同じ下限）。 */
	private readonly minDrag = 4;

	private start: Point | null = null;
	private preview: Konva.Group | null = null;

	constructor(private ctx: EditorContext) {}

	onPointerDown(pos: Point): void {
		this.start = pos;
		this.renderPreview(pos, pos);
	}

	onPointerMove(pos: Point): void {
		if (!this.start) return;
		this.renderPreview(this.start, pos);
	}

	onPointerUp(pos: Point): void {
		if (!this.start) return;
		const start = this.start;
		this.clearPreview();
		this.start = null;

		const shape = this.makeShape(start, pos);
		if (shape.width < this.minDrag || shape.height < this.minDrag) return;
		this.ctx.commitDoc(addShape(this.ctx.getDoc(), shape));
	}

	deactivate(): void {
		this.clearPreview();
		this.start = null;
	}

	/** 現在のドラッグ矩形 1 個を穴にした暗幕プレビューへ差し替える。 */
	private renderPreview(start: Point, end: Point): void {
		this.clearPreview();
		const veil = buildSpotlightVeil(
			[this.makeShape(start, end)],
			this.ctx.contentSize(),
		);
		this.preview = veil;
		this.ctx.previewLayer.add(veil);
		this.ctx.previewLayer.batchDraw();
	}

	private clearPreview(): void {
		if (this.preview) {
			this.preview.destroy();
			this.preview = null;
			this.ctx.previewLayer.batchDraw();
		}
	}

	private makeShape(start: Point, end: Point): SpotlightShape {
		const r = normalizeRect(start.x, start.y, end.x, end.y);
		return {
			id: this.ctx.newId(),
			stroke: this.ctx.style.stroke,
			strokeWidth: this.ctx.style.strokeWidth,
			rotation: 0,
			opacity: 1,
			type: "spotlight",
			...r,
		};
	}
}
