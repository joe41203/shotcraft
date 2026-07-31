import type Konva from "konva";
import type { RectShape, Shape } from "@/lib/editor/doc";
import { normalizeRect } from "@/lib/geometry";
import type { Point } from "../geometry-view";
import { shapeToNode } from "../render";
import { DragTool } from "./drag-tool";
import type { ToolName } from "./types";

/** ドラッグの外接矩形を描くツール。 */
export class RectTool extends DragTool {
	readonly name: ToolName = "rect";

	private makeShape(start: Point, end: Point): RectShape {
		const r = normalizeRect(start.x, start.y, end.x, end.y);
		return { ...this.base(), type: "rect", ...r };
	}

	protected createPreview(start: Point, end: Point): Konva.Shape {
		// 矩形は必ず Konva.Shape（Group にならない type）を返す。
		return shapeToNode(this.makeShape(start, end)) as Konva.Shape;
	}

	protected updatePreview(node: Konva.Shape, start: Point, end: Point): void {
		const r = normalizeRect(start.x, start.y, end.x, end.y);
		const rect = node as Konva.Rect;
		rect.setAttrs({ x: r.x, y: r.y, width: r.width, height: r.height });
	}

	protected buildShape(start: Point, end: Point): Shape | null {
		const shape = this.makeShape(start, end);
		if (shape.width < this.minDrag || shape.height < this.minDrag) return null;
		return shape;
	}
}
