import { describe, expect, it } from "vitest";
import { ERROR_BADGE_TEXT } from "../lib/capture-badge";

describe("ERROR_BADGE_TEXT", () => {
	it("失敗バッジは '!'", () => {
		expect(ERROR_BADGE_TEXT).toBe("!");
	});
});
