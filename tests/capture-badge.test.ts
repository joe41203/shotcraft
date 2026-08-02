import { describe, expect, it } from "vitest";
import {
	ERROR_BADGE_TEXT,
	formatTileProgressBadge,
} from "../lib/capture-badge";

describe("formatTileProgressBadge", () => {
	it("4 文字に収まる進捗は 現在/総数 形式", () => {
		expect(formatTileProgressBadge(1, 5)).toBe("1/5");
		expect(formatTileProgressBadge(3, 9)).toBe("3/9");
		expect(formatTileProgressBadge(9, 9)).toBe("9/9");
	});

	it("4 文字を超える進捗は割合へフォールバックする", () => {
		// "12/20" は 5 文字 → 60%
		expect(formatTileProgressBadge(12, 20)).toBe("60%");
		// "10/10" は 5 文字 → 100%
		expect(formatTileProgressBadge(10, 10)).toBe("100%");
	});

	it("総数 0 以下・非有限は空文字（進捗表示なし）", () => {
		expect(formatTileProgressBadge(0, 0)).toBe("");
		expect(formatTileProgressBadge(1, -1)).toBe("");
		expect(formatTileProgressBadge(1, Number.NaN)).toBe("");
	});

	it("current は 0..total にクランプする", () => {
		expect(formatTileProgressBadge(-1, 5)).toBe("0/5");
		expect(formatTileProgressBadge(9, 5)).toBe("5/5");
	});

	it("割合フォールバックは四捨五入した整数パーセント", () => {
		// "13/30" は 5 文字 → 43.33.. → 43%
		expect(formatTileProgressBadge(13, 30)).toBe("43%");
	});
});

describe("ERROR_BADGE_TEXT", () => {
	it("失敗バッジは '!'", () => {
		expect(ERROR_BADGE_TEXT).toBe("!");
	});
});
