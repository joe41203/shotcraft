import { describe, expect, it } from "vitest";
import {
	addShape,
	type CropRect,
	type EditorDoc,
	emptyDoc,
	findShape,
	type RectShape,
	removeShape,
	replaceShape,
	setCrop,
	type Shape,
	type TextShape,
	updateShape,
} from "../lib/editor/doc";

function rect(id: string, x = 0): RectShape {
	return {
		id,
		type: "rect",
		x,
		y: 0,
		width: 10,
		height: 10,
		stroke: "#ef4444",
		strokeWidth: 4,
		rotation: 0,
		opacity: 1,
	};
}

function text(id: string): TextShape {
	return {
		id,
		type: "text",
		x: 0,
		y: 0,
		text: "こんにちは",
		fontSize: 24,
		fontFamily: "rounded",
		stroke: "#ef4444",
		strokeWidth: 4,
		rotation: 0,
		opacity: 1,
	};
}

describe("addShape", () => {
	it("末尾に図形を追加した新しい doc を返す", () => {
		const doc = emptyDoc();
		const next = addShape(doc, rect("a"));
		expect(next.shapes).toHaveLength(1);
		expect(next.shapes[0]?.id).toBe("a");
	});

	it("元の doc を変更しない（immutable）", () => {
		const doc = emptyDoc();
		const next = addShape(doc, rect("a"));
		expect(doc.shapes).toHaveLength(0);
		expect(next).not.toBe(doc);
		expect(next.shapes).not.toBe(doc.shapes);
	});

	it("追加順が描画順（末尾が最前面）", () => {
		let doc: EditorDoc = emptyDoc();
		doc = addShape(doc, rect("a"));
		doc = addShape(doc, rect("b"));
		expect(doc.shapes.map((s) => s.id)).toEqual(["a", "b"]);
	});
});

describe("updateShape", () => {
	it("対象図形を patch でマージ更新する", () => {
		const doc = addShape(emptyDoc(), rect("a"));
		const next = updateShape(doc, "a", { x: 99, stroke: "#000000" });
		const shape = next.shapes[0] as RectShape;
		expect(shape.x).toBe(99);
		expect(shape.stroke).toBe("#000000");
		// 触っていないプロパティは維持
		expect(shape.width).toBe(10);
	});

	it("元の doc と対象図形を変更しない（immutable）", () => {
		const doc = addShape(emptyDoc(), rect("a"));
		const next = updateShape(doc, "a", { x: 99 });
		expect((doc.shapes[0] as RectShape).x).toBe(0);
		expect(next).not.toBe(doc);
		expect(next.shapes[0]).not.toBe(doc.shapes[0]);
	});

	it("対象 id が無ければ同一参照の doc をそのまま返す", () => {
		const doc = addShape(emptyDoc(), rect("a"));
		const next = updateShape(doc, "missing", { x: 99 });
		expect(next).toBe(doc);
	});

	it("対象以外の図形はそのままの参照で残す", () => {
		let doc = addShape(emptyDoc(), rect("a"));
		doc = addShape(doc, rect("b"));
		const next = updateShape(doc, "b", { x: 5 });
		expect(next.shapes[0]).toBe(doc.shapes[0]);
	});

	it("テキストの fontFamily パッチが通る", () => {
		const doc = addShape(emptyDoc(), text("t"));
		const next = updateShape(doc, "t", { fontFamily: "serif" });
		const shape = next.shapes[0] as TextShape;
		expect(shape.fontFamily).toBe("serif");
		// 触っていないプロパティは維持
		expect(shape.fontSize).toBe(24);
		expect(shape.text).toBe("こんにちは");
	});

	it("テキストの fontSize パッチが通る", () => {
		const doc = addShape(emptyDoc(), text("t"));
		const next = updateShape(doc, "t", { fontSize: 32 });
		const shape = next.shapes[0] as TextShape;
		expect(shape.fontSize).toBe(32);
		expect(shape.fontFamily).toBe("rounded");
	});

	it("fontFamily と fontSize を同時にパッチできる", () => {
		const doc = addShape(emptyDoc(), text("t"));
		const next = updateShape(doc, "t", { fontFamily: "mono", fontSize: 14 });
		const shape = next.shapes[0] as TextShape;
		expect(shape.fontFamily).toBe("mono");
		expect(shape.fontSize).toBe(14);
	});
});

describe("replaceShape", () => {
	it("対象図形を丸ごと置き換える", () => {
		const doc = addShape(emptyDoc(), rect("a", 0));
		const replaced: Shape = rect("a", 50);
		const next = replaceShape(doc, "a", replaced);
		expect(next.shapes[0]).toBe(replaced);
	});

	it("元の doc を変更しない（immutable）", () => {
		const doc = addShape(emptyDoc(), rect("a"));
		const next = replaceShape(doc, "a", rect("a", 50));
		expect((doc.shapes[0] as RectShape).x).toBe(0);
		expect(next).not.toBe(doc);
	});

	it("対象 id が無ければ同一参照の doc をそのまま返す", () => {
		const doc = addShape(emptyDoc(), rect("a"));
		const next = replaceShape(doc, "missing", rect("x"));
		expect(next).toBe(doc);
	});
});

describe("removeShape", () => {
	it("対象図形を除いた新しい doc を返す", () => {
		let doc = addShape(emptyDoc(), rect("a"));
		doc = addShape(doc, rect("b"));
		const next = removeShape(doc, "a");
		expect(next.shapes.map((s) => s.id)).toEqual(["b"]);
	});

	it("元の doc を変更しない（immutable）", () => {
		let doc = addShape(emptyDoc(), rect("a"));
		doc = addShape(doc, rect("b"));
		const next = removeShape(doc, "a");
		expect(doc.shapes).toHaveLength(2);
		expect(next).not.toBe(doc);
	});

	it("対象 id が無ければ同一参照の doc をそのまま返す", () => {
		const doc = addShape(emptyDoc(), rect("a"));
		const next = removeShape(doc, "missing");
		expect(next).toBe(doc);
	});
});

describe("findShape", () => {
	it("id で図形を取得する", () => {
		const doc = addShape(emptyDoc(), rect("a"));
		expect(findShape(doc, "a")?.id).toBe("a");
	});

	it("無ければ undefined", () => {
		expect(findShape(emptyDoc(), "a")).toBeUndefined();
	});
});

describe("emptyDoc", () => {
	it("crop は null で初期化される", () => {
		expect(emptyDoc().crop).toBeNull();
	});
});

describe("setCrop", () => {
	it("crop を差し替えた新しい doc を返す", () => {
		const crop: CropRect = { x: 10, y: 20, width: 100, height: 80 };
		const next = setCrop(emptyDoc(), crop);
		expect(next.crop).toEqual(crop);
	});

	it("null でクロップ解除できる", () => {
		const doc = setCrop(emptyDoc(), { x: 0, y: 0, width: 5, height: 5 });
		expect(setCrop(doc, null).crop).toBeNull();
	});

	it("shapes は保持される", () => {
		const doc = addShape(emptyDoc(), rect("a"));
		const next = setCrop(doc, { x: 0, y: 0, width: 5, height: 5 });
		expect(next.shapes).toBe(doc.shapes);
	});
});

describe("crop の保持", () => {
	const withCrop = (): EditorDoc =>
		setCrop(addShape(emptyDoc(), rect("a")), {
			x: 1,
			y: 2,
			width: 3,
			height: 4,
		});

	it("addShape は crop を保持する", () => {
		const next = addShape(withCrop(), rect("b"));
		expect(next.crop).toEqual({ x: 1, y: 2, width: 3, height: 4 });
	});

	it("updateShape は crop を保持する", () => {
		const next = updateShape(withCrop(), "a", { x: 99 });
		expect(next.crop).toEqual({ x: 1, y: 2, width: 3, height: 4 });
	});

	it("replaceShape は crop を保持する", () => {
		const next = replaceShape(withCrop(), "a", rect("a", 50));
		expect(next.crop).toEqual({ x: 1, y: 2, width: 3, height: 4 });
	});

	it("removeShape は crop を保持する", () => {
		const next = removeShape(withCrop(), "a");
		expect(next.crop).toEqual({ x: 1, y: 2, width: 3, height: 4 });
	});
});
