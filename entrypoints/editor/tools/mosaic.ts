import Konva from "konva";
import type { MosaicShape, Shape } from "@/lib/editor/doc";
import { normalizeRect } from "@/lib/geometry";
import { theme } from "@/lib/theme";
import type { Point } from "../geometry-view";
import { DragTool } from "./drag-tool";
import type { ToolName } from "./types";

/**
 * モザイク（ピクセル化）ツール。矩形ツールと同じドラッグ操作で領域を指定する。
 * ドラッグ中のプレビューは軽い半透明の枠で表し、確定後の実ピクセル化は
 * render.ts の buildMosaicNode がベース画像から行う（毎フレーム再ピクセル化は重い）。
 */
export class MosaicTool extends DragTool {
	readonly name: ToolName = "mosaic";

	private makeShape(start: Point, end: Point): MosaicShape {
		const r = normalizeRect(start.x, start.y, end.x, end.y);
		return { ...this.base(), type: "mosaic", ...r };
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
