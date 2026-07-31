import type Konva from "konva";
import type { ArrowShape, Shape } from "@/lib/editor/doc";
import type { Point } from "../geometry-view";
import { shapeToNode } from "../render";
import { DragTool } from "./drag-tool";
import type { ToolName } from "./types";

/** ドラッグ始点→終点の矢印を引くツール。 */
export class ArrowTool extends DragTool {
	readonly name: ToolName = "arrow";

	private makeShape(start: Point, end: Point): ArrowShape {
		return {
			...this.base(),
			type: "arrow",
			points: [start.x, start.y, end.x, end.y],
		};
	}

	protected createPreview(start: Point, end: Point): Konva.Shape {
		return shapeToNode(this.makeShape(start, end));
	}

	protected updatePreview(node: Konva.Shape, start: Point, end: Point): void {
		(node as Konva.Arrow).points([start.x, start.y, end.x, end.y]);
	}

	protected buildShape(start: Point, end: Point): Shape | null {
		return this.makeShape(start, end);
	}
}
