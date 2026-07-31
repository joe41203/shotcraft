import type Konva from "konva";
import type { EllipseShape, Shape } from "@/lib/editor/doc";
import { normalizeRect } from "@/lib/geometry";
import type { Point } from "../geometry-view";
import { shapeToNode } from "../render";
import { DragTool } from "./drag-tool";
import type { ToolName } from "./types";

/** ドラッグの外接矩形に内接する楕円を描くツール。 */
export class EllipseTool extends DragTool {
	readonly name: ToolName = "ellipse";

	private makeShape(start: Point, end: Point): EllipseShape {
		const r = normalizeRect(start.x, start.y, end.x, end.y);
		return { ...this.base(), type: "ellipse", ...r };
	}

	protected createPreview(start: Point, end: Point): Konva.Shape {
		// 楕円は必ず Konva.Shape（Group にならない type）を返す。
		return shapeToNode(this.makeShape(start, end)) as Konva.Shape;
	}

	protected updatePreview(node: Konva.Shape, start: Point, end: Point): void {
		const r = normalizeRect(start.x, start.y, end.x, end.y);
		const el = node as Konva.Ellipse;
		// shapeToNode と同じく外接矩形の中心・半径へ変換する。
		el.setAttrs({
			x: r.x + r.width / 2,
			y: r.y + r.height / 2,
			radiusX: r.width / 2,
			radiusY: r.height / 2,
		});
	}

	protected buildShape(start: Point, end: Point): Shape | null {
		const shape = this.makeShape(start, end);
		if (shape.width < this.minDrag || shape.height < this.minDrag) return null;
		return shape;
	}
}
