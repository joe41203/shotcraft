import Konva from "konva";
import type { EraseShape, Shape } from "@/lib/editor/doc";
import { normalizeRect } from "@/lib/geometry";
import { theme } from "@/lib/theme";
import type { Point } from "../geometry-view";
import { DragTool } from "./drag-tool";
import type { ToolName } from "./types";

/**
 * スマート消しゴム（なじませ）ツール。モザイク・ぼかしの姉妹で、同じドラッグ操作で
 * 領域を指定する。確定後の実処理（周辺色を取り込んだグラデーション塗り＋弱いぼかし）は
 * render.ts の buildEraseNode がベース画像から行う（毎フレーム再計算は重い）。
 * 色・線種・強度などのオプションは持たない（周辺色と領域サイズだけで塗りが決まる）。
 */
export class EraseTool extends DragTool {
	readonly name: ToolName = "erase";

	private makeShape(start: Point, end: Point): EraseShape {
		const r = normalizeRect(start.x, start.y, end.x, end.y);
		return {
			...this.base(),
			type: "erase",
			...r,
		};
	}

	protected createPreview(start: Point, end: Point): Konva.Shape {
		const r = normalizeRect(start.x, start.y, end.x, end.y);
		return new Konva.Rect({
			x: r.x,
			y: r.y,
			width: r.width,
			height: r.height,
			fill: "rgba(15, 23, 42, 0.5)",
			stroke: theme.ring,
			strokeWidth: 1,
			dash: [4, 4],
		});
	}

	protected updatePreview(node: Konva.Shape, start: Point, end: Point): void {
		const r = normalizeRect(start.x, start.y, end.x, end.y);
		(node as Konva.Rect).setAttrs({
			x: r.x,
			y: r.y,
			width: r.width,
			height: r.height,
		});
	}

	protected buildShape(start: Point, end: Point): Shape | null {
		const shape = this.makeShape(start, end);
		if (shape.width < this.minDrag || shape.height < this.minDrag) return null;
		return shape;
	}
}
