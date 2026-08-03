import { describe, expect, it } from "vitest";
import { exportFilename } from "../entrypoints/editor/export";
import {
	EXPORT_QUALITY_VALUES,
	normalizeExportFormat,
	normalizeExportQuality,
} from "../lib/editor/export-format";

describe("exportFilename", () => {
	it("shotcraft-YYYYMMDD-HHmmss.png 形式でローカル時刻を埋める（既定 PNG）", () => {
		// 2026-07-31 09:05:03 (ローカル時刻)
		const d = new Date(2026, 6, 31, 9, 5, 3);
		expect(exportFilename(d)).toBe("shotcraft-20260731-090503.png");
	});

	it("各フィールドをゼロ埋めする", () => {
		// 2026-01-02 03:04:05
		const d = new Date(2026, 0, 2, 3, 4, 5);
		expect(exportFilename(d)).toBe("shotcraft-20260102-030405.png");
	});

	it("形式に応じた拡張子（png / jpg / webp）を付ける", () => {
		const d = new Date(2026, 0, 2, 3, 4, 5);
		expect(exportFilename(d, "png")).toBe("shotcraft-20260102-030405.png");
		expect(exportFilename(d, "jpeg")).toBe("shotcraft-20260102-030405.jpg");
		expect(exportFilename(d, "webp")).toBe("shotcraft-20260102-030405.webp");
	});

	it("引数なしでも妥当な形式を返す", () => {
		expect(exportFilename()).toMatch(/^shotcraft-\d{8}-\d{6}\.png$/);
	});
});

describe("normalizeExportFormat", () => {
	it("3 値はそのまま通す", () => {
		expect(normalizeExportFormat("png")).toBe("png");
		expect(normalizeExportFormat("jpeg")).toBe("jpeg");
		expect(normalizeExportFormat("webp")).toBe("webp");
	});

	it("未設定・不正値は png へ", () => {
		expect(normalizeExportFormat(undefined)).toBe("png");
		expect(normalizeExportFormat(null)).toBe("png");
		expect(normalizeExportFormat("gif")).toBe("png");
		expect(normalizeExportFormat(1)).toBe("png");
	});
});

describe("normalizeExportQuality", () => {
	it("3 値はそのまま通す", () => {
		expect(normalizeExportQuality("high")).toBe("high");
		expect(normalizeExportQuality("normal")).toBe("normal");
		expect(normalizeExportQuality("low")).toBe("low");
	});

	it("未設定・不正値は normal へ", () => {
		expect(normalizeExportQuality(undefined)).toBe("normal");
		expect(normalizeExportQuality(null)).toBe("normal");
		expect(normalizeExportQuality("ultra")).toBe("normal");
		expect(normalizeExportQuality(0.9)).toBe("normal");
	});
});

describe("EXPORT_QUALITY_VALUES", () => {
	it("高 0.92 / 標準 0.85 / 低 0.7 の品質値を持つ", () => {
		expect(EXPORT_QUALITY_VALUES.high).toBe(0.92);
		expect(EXPORT_QUALITY_VALUES.normal).toBe(0.85);
		expect(EXPORT_QUALITY_VALUES.low).toBe(0.7);
	});
});
