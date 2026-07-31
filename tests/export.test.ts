import { describe, expect, it } from "vitest";
import { exportFilename } from "../entrypoints/editor/export";

describe("exportFilename", () => {
	it("shotcraft-YYYYMMDD-HHmmss.png 形式でローカル時刻を埋める", () => {
		// 2026-07-31 09:05:03 (ローカル時刻)
		const d = new Date(2026, 6, 31, 9, 5, 3);
		expect(exportFilename(d)).toBe("shotcraft-20260731-090503.png");
	});

	it("各フィールドをゼロ埋めする", () => {
		// 2026-01-02 03:04:05
		const d = new Date(2026, 0, 2, 3, 4, 5);
		expect(exportFilename(d)).toBe("shotcraft-20260102-030405.png");
	});

	it("引数なしでも妥当な形式を返す", () => {
		expect(exportFilename()).toMatch(/^shotcraft-\d{8}-\d{6}\.png$/);
	});
});
