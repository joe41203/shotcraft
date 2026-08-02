import { describe, expect, it } from "vitest";
import { resolveDash, shapeSupportsDash } from "../lib/editor/dash";
import type { ShapeType } from "../lib/editor/doc";

describe("resolveDash", () => {
	it("dash が false / 未指定なら実線（空配列）", () => {
		expect(resolveDash(false, 4)).toEqual([]);
		expect(resolveDash(undefined, 4)).toEqual([]);
	});

	it("dash が true なら [ダッシュ, 間隔] を返す", () => {
		const [d, g] = resolveDash(true, 4);
		expect(d).toBeGreaterThan(0);
		expect(g).toBeGreaterThan(0);
	});

	it("線幅が太いほどダッシュ・間隔も大きくなる", () => {
		const thin = resolveDash(true, 2);
		const thick = resolveDash(true, 8);
		expect(thick[0]).toBeGreaterThan(thin[0] as number);
		expect(thick[1]).toBeGreaterThan(thin[1] as number);
	});

	it("細い線でも下限を下回らない", () => {
		const [d, g] = resolveDash(true, 0);
		expect(d).toBeGreaterThanOrEqual(4);
		expect(g).toBeGreaterThanOrEqual(4);
	});

	it("負の線幅でも下限を返す（NaN を出さない）", () => {
		const [d, g] = resolveDash(true, -5);
		expect(d).toBeGreaterThanOrEqual(4);
		expect(g).toBeGreaterThanOrEqual(4);
	});
});

describe("shapeSupportsDash", () => {
	it("矢印・直線・矩形・楕円・ペンは対応する", () => {
		for (const type of [
			"arrow",
			"line",
			"rect",
			"ellipse",
			"pen",
		] as ShapeType[]) {
			expect(shapeSupportsDash(type)).toBe(true);
		}
	});

	it("マーカー・テキスト・モザイク・ステップ・フキダシは対応しない", () => {
		for (const type of [
			"marker",
			"text",
			"mosaic",
			"step",
			"callout",
		] as ShapeType[]) {
			expect(shapeSupportsDash(type)).toBe(false);
		}
	});
});
