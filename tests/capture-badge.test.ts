import { describe, expect, it } from "vitest";
import {
	BADGE_MAX_CHARS,
	ERROR_BADGE_TEXT,
	formatCountdownBadge,
	formatTileProgressBadge,
} from "../lib/capture-badge";

describe("formatCountdownBadge", () => {
	it("整数秒はそのまま文字列にする", () => {
		expect(formatCountdownBadge(3)).toBe("3");
		expect(formatCountdownBadge(2)).toBe("2");
		expect(formatCountdownBadge(1)).toBe("1");
	});

	it("端数は切り上げる（あと n 秒の体感に合わせる）", () => {
		expect(formatCountdownBadge(2.3)).toBe("3");
		expect(formatCountdownBadge(0.1)).toBe("1");
	});

	it("0 以下・非有限は空文字（バッジ消去相当）", () => {
		expect(formatCountdownBadge(0)).toBe("");
		expect(formatCountdownBadge(-1)).toBe("");
		expect(formatCountdownBadge(Number.NaN)).toBe("");
		expect(formatCountdownBadge(Number.POSITIVE_INFINITY)).toBe("");
	});

	it("桁あふれは BADGE_MAX_CHARS で頭打ち", () => {
		expect(formatCountdownBadge(99999).length).toBe(BADGE_MAX_CHARS);
	});
});

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
