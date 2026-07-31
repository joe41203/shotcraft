import { describe, expect, it } from "vitest";
import {
	CAPTURE_DELAY_OPTIONS,
	clampCaptureDelayMs,
	MAX_CAPTURE_DELAY_MS,
} from "../lib/capture-delay";

describe("clampCaptureDelayMs", () => {
	it("undefined は 0（即時）", () => {
		expect(clampCaptureDelayMs(undefined)).toBe(0);
	});

	it("0 以下は 0（即時。後方互換）", () => {
		expect(clampCaptureDelayMs(0)).toBe(0);
		expect(clampCaptureDelayMs(-1)).toBe(0);
		expect(clampCaptureDelayMs(-5000)).toBe(0);
	});

	it("NaN / 非有限は 0", () => {
		expect(clampCaptureDelayMs(Number.NaN)).toBe(0);
		expect(clampCaptureDelayMs(Number.POSITIVE_INFINITY)).toBe(0);
		expect(clampCaptureDelayMs(Number.NEGATIVE_INFINITY)).toBe(0);
	});

	it("正の値はそのまま（端数は切り捨て）", () => {
		expect(clampCaptureDelayMs(3000)).toBe(3000);
		expect(clampCaptureDelayMs(5000)).toBe(5000);
		expect(clampCaptureDelayMs(1234.9)).toBe(1234);
	});

	it("上限を超える値は MAX_CAPTURE_DELAY_MS にクランプする", () => {
		expect(clampCaptureDelayMs(MAX_CAPTURE_DELAY_MS + 1)).toBe(
			MAX_CAPTURE_DELAY_MS,
		);
		expect(clampCaptureDelayMs(999_999_999)).toBe(MAX_CAPTURE_DELAY_MS);
	});
});

describe("CAPTURE_DELAY_OPTIONS", () => {
	it("なし（0）・3秒・5秒を含む", () => {
		expect(CAPTURE_DELAY_OPTIONS.map((o) => o.value)).toEqual([0, 3000, 5000]);
	});

	it("各選択肢は clampCaptureDelayMs を通しても値が変わらない", () => {
		for (const opt of CAPTURE_DELAY_OPTIONS) {
			expect(clampCaptureDelayMs(opt.value)).toBe(opt.value);
		}
	});
});
