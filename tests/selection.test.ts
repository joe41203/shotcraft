import { describe, expect, it } from "vitest";
import type {
	ArrowShape,
	RectShape,
	Shape,
	StepShape,
	TextShape,
} from "../lib/editor/doc";
import {
	type BBox,
	rectsIntersect,
	shapeBoundingBox,
	shapesInBand,
} from "../lib/editor/selection";

function rect(id: string, x: number, y: number): RectShape {
	return {
		id,
		type: "rect",
		x,
		y,
		width: 20,
		height: 20,
		stroke: "#fff",
		strokeWidth: 4,
		rotation: 0,
		opacity: 1,
	};
}

function arrow(id: string, points: number[]): ArrowShape {
	return {
		id,
		type: "arrow",
		points,
		stroke: "#fff",
		strokeWidth: 4,
		rotation: 0,
		opacity: 1,
	};
}

describe("rectsIntersect", () => {
	const a: BBox = { x: 0, y: 0, width: 10, height: 10 };

	it("重なる矩形は true", () => {
		expect(rectsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
	});

	it("完全に離れた矩形は false", () => {
		expect(rectsIntersect(a, { x: 100, y: 100, width: 5, height: 5 })).toBe(
			false,
		);
	});

	it("辺が接するだけでも交差とみなす", () => {
		expect(rectsIntersect(a, { x: 10, y: 0, width: 5, height: 5 })).toBe(true);
	});

	it("一方が他方を完全に包含する場合も true", () => {
		expect(rectsIntersect(a, { x: 2, y: 2, width: 3, height: 3 })).toBe(true);
	});
});

describe("shapeBoundingBox", () => {
	it("x/y/width/height を持つ図形はそのまま", () => {
		expect(shapeBoundingBox(rect("r", 10, 20))).toEqual({
			x: 10,
			y: 20,
			width: 20,
			height: 20,
		});
	});

	it("スマート消しゴム（erase）も x/y/width/height の外接矩形をそのまま返す", () => {
		const erase: Shape = {
			id: "e",
			type: "erase",
			x: 5,
			y: 15,
			width: 40,
			height: 30,
			stroke: "#fff",
			strokeWidth: 4,
			rotation: 0,
			opacity: 1,
		};
		expect(shapeBoundingBox(erase)).toEqual({
			x: 5,
			y: 15,
			width: 40,
			height: 30,
		});
	});

	it("points を持つ矢印は点列の外接矩形（負方向でも正規化）", () => {
		expect(shapeBoundingBox(arrow("a", [30, 40, 10, 5]))).toEqual({
			x: 10,
			y: 5,
			width: 20,
			height: 35,
		});
	});

	it("step は中心 ± 半径の正方形", () => {
		const step: StepShape = {
			id: "s",
			type: "step",
			x: 50,
			y: 50,
			number: 1,
			radius: 16,
			stroke: "#fff",
			strokeWidth: 4,
			rotation: 0,
			opacity: 1,
		};
		expect(shapeBoundingBox(step)).toEqual({
			x: 34,
			y: 34,
			width: 32,
			height: 32,
		});
	});

	it("text は概算の外接矩形を返す（幅・高さが正）", () => {
		const text: TextShape = {
			id: "t",
			type: "text",
			x: 0,
			y: 0,
			text: "hello\nworld!",
			fontSize: 20,
			stroke: "#fff",
			strokeWidth: 4,
			rotation: 0,
			opacity: 1,
		};
		const box = shapeBoundingBox(text);
		expect(box.x).toBe(0);
		expect(box.y).toBe(0);
		expect(box.width).toBeGreaterThan(0);
		// 2 行 × 20px × 1.2 = 48px。
		expect(box.height).toBeCloseTo(48);
	});
});

describe("shapesInBand", () => {
	const shapes: Shape[] = [
		rect("a", 0, 0),
		rect("b", 100, 100),
		arrow("c", [10, 10, 15, 15]),
	];

	it("バンドに交差する図形の id を描画順で返す", () => {
		const band: BBox = { x: -5, y: -5, width: 30, height: 30 };
		// a（0-20）と c（10-15）は交差、b（100-120）は外れる。
		expect(shapesInBand(shapes, band)).toEqual(["a", "c"]);
	});

	it("何も交差しなければ空配列", () => {
		expect(
			shapesInBand(shapes, { x: 500, y: 500, width: 10, height: 10 }),
		).toEqual([]);
	});

	it("全体を覆うバンドは全 id を返す", () => {
		expect(
			shapesInBand(shapes, { x: -10, y: -10, width: 200, height: 200 }),
		).toEqual(["a", "b", "c"]);
	});
});
