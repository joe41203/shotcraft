import { describe, expect, it } from "vitest";
import {
	canRedo,
	canUndo,
	commit,
	type History,
	initHistory,
	MAX_HISTORY,
	redo,
	undo,
} from "../lib/editor/history";

describe("initHistory", () => {
	it("present だけを持つ空の履歴を作る", () => {
		const h = initHistory("a");
		expect(h.present).toBe("a");
		expect(h.past).toEqual([]);
		expect(h.future).toEqual([]);
		expect(canUndo(h)).toBe(false);
		expect(canRedo(h)).toBe(false);
	});
});

describe("commit", () => {
	it("present を past に積み、next を新しい present にする", () => {
		const h = commit(initHistory("a"), "b");
		expect(h.present).toBe("b");
		expect(h.past).toEqual(["a"]);
		expect(canUndo(h)).toBe(true);
	});

	it("新規操作なので future をクリアする", () => {
		let h = initHistory("a");
		h = commit(h, "b");
		h = undo(h); // present=a, future=[b]
		expect(h.future).toEqual(["b"]);
		h = commit(h, "c"); // 新しい分岐: future は捨てる
		expect(h.present).toBe("c");
		expect(h.future).toEqual([]);
		expect(canRedo(h)).toBe(false);
	});

	it("元の履歴を変更しない（immutable）", () => {
		const h0 = initHistory("a");
		const h1 = commit(h0, "b");
		expect(h0.present).toBe("a");
		expect(h0.past).toEqual([]);
		expect(h1).not.toBe(h0);
	});

	it("past が上限を超えたら最古を捨てる", () => {
		let h: History<number> = initHistory(0);
		// 上限 + 10 回 commit する
		for (let i = 1; i <= MAX_HISTORY + 10; i++) {
			h = commit(h, i);
		}
		expect(h.past).toHaveLength(MAX_HISTORY);
		// 60 回 commit（present=60）で past は末尾 50 件 [10..59]。最古の 0..9 が捨てられる
		expect(h.past[0]).toBe(10);
		expect(h.past.at(-1)).toBe(MAX_HISTORY + 9);
		expect(h.present).toBe(MAX_HISTORY + 10);
	});
});

describe("undo / redo", () => {
	it("undo は 1 つ前の状態に戻し、present を future へ退避する", () => {
		let h = commit(initHistory("a"), "b");
		h = undo(h);
		expect(h.present).toBe("a");
		expect(h.future).toEqual(["b"]);
		expect(canRedo(h)).toBe(true);
	});

	it("redo は 1 つ先へ進め、present を past へ積む", () => {
		let h = commit(initHistory("a"), "b");
		h = undo(h);
		h = redo(h);
		expect(h.present).toBe("b");
		expect(h.past).toEqual(["a"]);
		expect(h.future).toEqual([]);
	});

	it("past が空のとき undo は同一参照でそのまま返す", () => {
		const h = initHistory("a");
		expect(undo(h)).toBe(h);
	});

	it("future が空のとき redo は同一参照でそのまま返す", () => {
		const h = commit(initHistory("a"), "b");
		expect(redo(h)).toBe(h);
	});

	it("複数段の undo/redo が往復で一致する", () => {
		let h: History<string> = initHistory("a");
		h = commit(h, "b");
		h = commit(h, "c");
		h = commit(h, "d"); // a,b,c | d
		h = undo(h); // a,b | c (future: d)
		h = undo(h); // a | b (future: c,d)
		expect(h.present).toBe("b");
		expect(h.future).toEqual(["c", "d"]);
		h = redo(h);
		h = redo(h);
		expect(h.present).toBe("d");
		expect(h.future).toEqual([]);
	});

	it("undo は元の履歴を変更しない（immutable）", () => {
		const h0 = commit(initHistory("a"), "b");
		const h1 = undo(h0);
		expect(h0.present).toBe("b");
		expect(h0.future).toEqual([]);
		expect(h1).not.toBe(h0);
	});
});
