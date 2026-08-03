import { describe, expect, it } from "vitest";
import {
	addShape,
	emptyDoc,
	nextStepNumber,
	removeShape,
	type Shape,
	type StepShape,
} from "../lib/editor/doc";
import {
	resolveNextStepNumber,
	STEP_RADIUS,
	stepFontSize,
} from "../lib/editor/step";

function step(id: string, number: number): StepShape {
	return {
		id,
		type: "step",
		x: 0,
		y: 0,
		number,
		stroke: "#fb7185",
		strokeWidth: 4,
		rotation: 0,
		opacity: 1,
	};
}

function rect(id: string): Shape {
	return {
		id,
		type: "rect",
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		stroke: "#fb7185",
		strokeWidth: 4,
		rotation: 0,
		opacity: 1,
	};
}

describe("nextStepNumber", () => {
	it("step が 1 つも無ければ 1 を返す", () => {
		expect(nextStepNumber([])).toBe(1);
		expect(nextStepNumber([rect("a")])).toBe(1);
	});

	it("既存 step の最大 number + 1 を返す", () => {
		expect(nextStepNumber([step("a", 1), step("b", 2)])).toBe(3);
	});

	it("step 以外のシェイプは無視する", () => {
		expect(nextStepNumber([step("a", 1), rect("b"), step("c", 2)])).toBe(3);
	});

	it("番号が連続でなくても最大値基準で決める（振り直さない）", () => {
		// number 2 を削除した状態を想定（1 と 3 が残る）。
		expect(nextStepNumber([step("a", 1), step("c", 3)])).toBe(4);
	});

	it("順序に依らず最大値を採る", () => {
		expect(nextStepNumber([step("b", 5), step("a", 2), step("c", 3)])).toBe(6);
	});

	it("addShape で順に置くと 1,2,3… の連番になる", () => {
		let doc = emptyDoc();
		const n1 = nextStepNumber(doc.shapes);
		doc = addShape(doc, step("a", n1));
		const n2 = nextStepNumber(doc.shapes);
		doc = addShape(doc, step("b", n2));
		const n3 = nextStepNumber(doc.shapes);
		doc = addShape(doc, step("c", n3));
		expect([n1, n2, n3]).toEqual([1, 2, 3]);
	});

	it("途中のバッジを削除しても残りの番号は振り直さず、次は最大+1", () => {
		let doc = emptyDoc();
		doc = addShape(doc, step("a", 1));
		doc = addShape(doc, step("b", 2));
		doc = addShape(doc, step("c", 3));
		// 番号 2 のバッジを削除。
		doc = removeShape(doc, "b");
		// 残りは 1 と 3。次は 4（3 の振り直しはしない）。
		expect(nextStepNumber(doc.shapes)).toBe(4);
		// 既存バッジの番号は変わらない。
		expect((doc.shapes[0] as StepShape).number).toBe(1);
		expect((doc.shapes[1] as StepShape).number).toBe(3);
	});
});

describe("resolveNextStepNumber", () => {
	it("override 未指定なら nextStepNumber と同じ（連番）", () => {
		expect(resolveNextStepNumber([])).toBe(1);
		expect(resolveNextStepNumber([step("a", 1), step("b", 2)])).toBe(3);
		expect(resolveNextStepNumber([step("a", 1), step("b", 2)], null)).toBe(3);
		expect(resolveNextStepNumber([step("a", 1), step("b", 2)], undefined)).toBe(
			3,
		);
	});

	it("有効な正整数の override を優先する（既存最大に依らない）", () => {
		// 既存最大が 5 でも override=1 なら 1 を返す（「次を 1 に戻す」）。
		expect(resolveNextStepNumber([step("a", 5)], 1)).toBe(1);
		expect(resolveNextStepNumber([step("a", 3), step("b", 7)], 2)).toBe(2);
	});

	it("非正・非整数・数値でない override は連番へフォールバックする", () => {
		const shapes = [step("a", 1), step("b", 2)];
		expect(resolveNextStepNumber(shapes, 0)).toBe(3);
		expect(resolveNextStepNumber(shapes, -1)).toBe(3);
		expect(resolveNextStepNumber(shapes, 1.5)).toBe(3);
		expect(resolveNextStepNumber(shapes, Number.NaN)).toBe(3);
	});

	it("override=1 を置いた後は（override 破棄で）また連番に戻る", () => {
		// 「次を 1 に戻す」で 1 を置く → doc に number 1 が入る。
		let doc = emptyDoc();
		const first = resolveNextStepNumber(doc.shapes, 1);
		expect(first).toBe(1);
		doc = addShape(doc, step("a", first));
		// override を破棄した次は連番（最大 1 の次＝2）。
		expect(resolveNextStepNumber(doc.shapes)).toBe(2);
	});
});

describe("stepFontSize", () => {
	it("既定半径では正の整数フォントサイズを返す", () => {
		const size = stepFontSize(STEP_RADIUS);
		expect(size).toBeGreaterThan(0);
		expect(Number.isInteger(size)).toBe(true);
	});

	it("半径に比例して大きくなる", () => {
		expect(stepFontSize(32)).toBeGreaterThan(stepFontSize(16));
	});
});
