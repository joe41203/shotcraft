import { describe, expect, it } from "vitest";
import {
	addShape,
	emptyDoc,
	nextStepNumber,
	removeShape,
	type Shape,
	type StepShape,
} from "../lib/editor/doc";
import { STEP_RADIUS, stepFontSize } from "../lib/editor/step";

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
