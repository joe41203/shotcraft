import { addShape, nextStepNumber, type StepShape } from "@/lib/editor/doc";
import type { Point } from "../geometry-view";
import type { EditorContext, Tool, ToolName } from "./types";

/**
 * 番号付きステップ注釈ツール。
 * クリックするたびに連番の丸バッジ（①②③…）をその位置へ配置する。
 * 番号は配置時点の「既存 step の最大 number + 1」（nextStepNumber）。
 * ドラッグでなくクリックの一操作で確定するため、プレビューは持たず
 * pointerdown で即 commit する。移動・削除は選択ツールで行う。
 */
export class StepTool implements Tool {
	readonly name: ToolName = "step";

	constructor(private ctx: EditorContext) {}

	onPointerDown(pos: Point): void {
		const doc = this.ctx.getDoc();
		const shape: StepShape = {
			id: this.ctx.newId(),
			type: "step",
			x: pos.x,
			y: pos.y,
			number: nextStepNumber(doc.shapes),
			stroke: this.ctx.style.stroke,
			strokeWidth: this.ctx.style.strokeWidth,
			rotation: 0,
			opacity: 1,
		};
		this.ctx.commitDoc(addShape(doc, shape));
	}
}
