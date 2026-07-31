import { describe, expect, it } from "vitest";
import { DragTool } from "../entrypoints/editor/tools/drag-tool";
import type {
	EditorContext,
	ToolName,
} from "../entrypoints/editor/tools/types";
import type { Shape } from "../lib/editor/doc";

/**
 * 太さ選択 UI を廃止し、新規図形の線の太さは 4px 固定になった。
 * DragTool.base() は ctx.style.strokeWidth を新規図形へ素通しで焼き込むので、
 * style を 4 にすれば新規図形の太さも 4 になることを Konva 非依存で確認する。
 * base() は protected のため、テスト用の薄い具象で公開する。
 */
class BaseProbeTool extends DragTool {
	readonly name: ToolName = "rect";
	// buildShape/createPreview/updatePreview は本テストでは使わない（Konva 非依存）。
	protected createPreview(): never {
		throw new Error("未使用");
	}
	protected updatePreview(): void {}
	protected buildShape(): Shape | null {
		return null;
	}
	newShapeBase() {
		return this.base();
	}
}

function ctxWithStrokeWidth(strokeWidth: number): EditorContext {
	// base() が参照するのは style と newId のみ。他は未使用なので最小限だけ用意する。
	let n = 0;
	return {
		style: { stroke: "#fb7185", strokeWidth, fontSize: 24, dash: false },
		newId: () => `s${(n += 1)}`,
	} as unknown as EditorContext;
}

describe("新規図形の線の太さ（4px 固定）", () => {
	it("style.strokeWidth = 4 のとき新規図形の base() は strokeWidth 4 を焼き込む", () => {
		const tool = new BaseProbeTool(ctxWithStrokeWidth(4));
		expect(tool.newShapeBase().strokeWidth).toBe(4);
	});

	it("base() は style.strokeWidth を素通しする（固定化はデフォルト値側で行う）", () => {
		const tool = new BaseProbeTool(ctxWithStrokeWidth(8));
		expect(tool.newShapeBase().strokeWidth).toBe(8);
	});
});
