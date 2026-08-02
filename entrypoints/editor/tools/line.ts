import type Konva from "konva";
import type { LineShape, Shape } from "@/lib/editor/doc";
import { snapAngle } from "@/lib/geometry";
import type { Point } from "../geometry-view";
import { shapeToNode } from "../render";
import { DragTool } from "./drag-tool";
import type { ToolName } from "./types";

/** ドラッグ始点→終点の直線（矢頭なし）を引くツール。矢印ツールの姉妹。 */
export class LineTool extends DragTool {
	readonly name: ToolName = "line";

	/** Shift 押下中は角度を 0/45/90° 刻みへスナップする（矢印と同じ）。 */
	protected override constrain(start: Point, end: Point): Point {
		return snapAngle(start, end);
	}

	private makeShape(start: Point, end: Point): LineShape {
		return {
			...this.base(),
			type: "line",
			points: [start.x, start.y, end.x, end.y],
		};
	}

	protected createPreview(start: Point, end: Point): Konva.Shape {
		// 直線は必ず Konva.Shape（Group にならない type）を返す。
		return shapeToNode(this.makeShape(start, end)) as Konva.Shape;
	}

	protected updatePreview(node: Konva.Shape, start: Point, end: Point): void {
		(node as Konva.Line).points([start.x, start.y, end.x, end.y]);
	}

	protected buildShape(start: Point, end: Point): Shape | null {
		return this.makeShape(start, end);
	}
}
