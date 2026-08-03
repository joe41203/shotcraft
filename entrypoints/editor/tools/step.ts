import { addShape, type StepShape } from "@/lib/editor/doc";
import { resolveNextStepNumber } from "@/lib/editor/step";
import type { Point } from "../geometry-view";
import type { EditorContext, Tool, ToolName } from "./types";

/**
 * 番号付きステップ注釈ツール。
 * クリックするたびに連番の丸バッジ（①②③…）をその位置へ配置する。
 * 番号は配置時点の「既存 step の最大 number + 1」（連番）だが、フライアウトの
 * 「次を1に戻す」で番号の明示上書き（stepNumberOverride）が入っていればそれを優先し、
 * 1 個置いたら上書きを破棄して以降はまた連番に戻る（resolveNextStepNumber）。
 * ドラッグでなくクリックの一操作で確定するため、プレビューは持たず
 * pointerdown で即 commit する。移動・削除は選択ツールで行う。
 */
export class StepTool implements Tool {
	readonly name: ToolName = "step";

	constructor(private ctx: EditorContext) {}

	onPointerDown(pos: Point): void {
		const doc = this.ctx.getDoc();
		// 明示上書き（「次を1に戻す」）があればそれを、無ければ連番を採る。
		const override = this.ctx.stepNumberOverride();
		const number = resolveNextStepNumber(doc.shapes, override);
		const shape: StepShape = {
			id: this.ctx.newId(),
			type: "step",
			x: pos.x,
			y: pos.y,
			number,
			stroke: this.ctx.style.stroke,
			strokeWidth: this.ctx.style.strokeWidth,
			rotation: 0,
			opacity: 1,
		};
		this.ctx.commitDoc(addShape(doc, shape));
		// 上書きは「次の 1 個」だけに効く。置いたら破棄して以降はまた連番。
		if (override != null) this.ctx.clearStepNumberOverride();
	}
}
