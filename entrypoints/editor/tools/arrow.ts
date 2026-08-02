import type Konva from "konva";
import { curvedArrowControl } from "@/lib/editor/arrow";
import type { ArrowShape, Shape } from "@/lib/editor/doc";
import { snapAngle } from "@/lib/geometry";
import type { Point } from "../geometry-view";
import { shapeToNode } from "../render";
import { DragTool } from "./drag-tool";
import type { ToolName } from "./types";

/** ドラッグ始点→終点の矢印を引くツール。 */
export class ArrowTool extends DragTool {
	readonly name: ToolName = "arrow";

	/** Shift 押下中は角度を 0/45/90° 刻みへスナップする。 */
	protected override constrain(start: Point, end: Point): Point {
		return snapAngle(start, end);
	}

	private makeShape(start: Point, end: Point): ArrowShape {
		return {
			...this.base(),
			type: "arrow",
			points: [start.x, start.y, end.x, end.y],
			// 現在のツールバー選択（片側 / 両側 / 曲線）を新規矢印へ載せる。
			arrowStyle: this.ctx.style.arrowStyle,
		};
	}

	protected createPreview(start: Point, end: Point): Konva.Shape {
		// 矢印は必ず Konva.Shape（Group にならない type）を返す。スタイル（両側の矢頭・
		// 曲線の tension）はこの生成時に確定し、ドラッグ中は points だけ差し替える
		// （arrowStyle はドラッグ中に変わらないため）。
		return shapeToNode(this.makeShape(start, end)) as Konva.Shape;
	}

	protected updatePreview(node: Konva.Shape, start: Point, end: Point): void {
		const arrow = node as Konva.Arrow;
		if (this.ctx.style.arrowStyle === "curved") {
			// 曲線は始点・制御点・終点の 3 点。制御点は始点終点から都度計算する。
			const c = curvedArrowControl([start.x, start.y, end.x, end.y]);
			arrow.points([start.x, start.y, c.x, c.y, end.x, end.y]);
		} else {
			arrow.points([start.x, start.y, end.x, end.y]);
		}
	}

	protected buildShape(start: Point, end: Point): Shape | null {
		return this.makeShape(start, end);
	}
}
