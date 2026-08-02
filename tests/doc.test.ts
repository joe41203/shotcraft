import { describe, expect, it } from "vitest";
import {
	addShape,
	type ArrowShape,
	type CropRect,
	duplicateShape,
	type EditorDoc,
	emptyDoc,
	findShape,
	moveShapeBackward,
	moveShapeForward,
	moveShapeToBack,
	moveShapeToFront,
	type RectShape,
	removeShape,
	replaceShape,
	setCrop,
	type Shape,
	shapeSupportsColor,
	type ShapeType,
	type StepShape,
	type TextShape,
	translateShape,
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
		// fontFamily は後方互換の受け流しフィールド（旧データが持つ値の再現）。
		// 現在はフォント固定なので描画では無視されるが、型・更新は壊れないこと。
		fontFamily: "mochiy",
		stroke: "#ef4444",
		strokeWidth: 4,
		rotation: 0,
		opacity: 1,
	};
}

function arrow(id: string, x = 0): ArrowShape {
	return {
		id,
		type: "arrow",
		points: [x, x, x + 10, x + 10],
		stroke: "#ef4444",
		strokeWidth: 4,
		rotation: 0,
		opacity: 1,
	};
}

function step(id: string, number: number): StepShape {
	return {
		id,
		type: "step",
		x: 0,
		y: 0,
		number,
		stroke: "#ef4444",
		strokeWidth: 4,
		rotation: 0,
		opacity: 1,
	};
}

/** 指定 id 順で rect を並べた doc を作るヘルパ（z 順テスト用）。 */
function docOf(...ids: string[]): EditorDoc {
	let doc = emptyDoc();
	for (const id of ids) doc = addShape(doc, rect(id));
	return doc;
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

	it("旧データ由来の fontFamily（後方互換フィールド）を保持して読み込める", () => {
		// フォント選択機能撤去後も、旧保存データに残る fontFamily key で壊れないこと。
		const doc = addShape(emptyDoc(), text("t"));
		const shape = doc.shapes[0] as TextShape;
		expect(shape.fontFamily).toBe("mochiy");
		expect(shape.text).toBe("こんにちは");
	});

	it("テキストの fontSize パッチが通る", () => {
		const doc = addShape(emptyDoc(), text("t"));
		const next = updateShape(doc, "t", { fontSize: 32 });
		const shape = next.shapes[0] as TextShape;
		expect(shape.fontSize).toBe(32);
		// 触っていないプロパティ（後方互換の fontFamily 含む）は維持
		expect(shape.fontFamily).toBe("mochiy");
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

describe("shapeSupportsColor", () => {
	it("色を持つ図形（矢印・直線・矩形・楕円・ペン・マーカー・テキスト・ステップ・フキダシ）は true", () => {
		for (const type of [
			"arrow",
			"line",
			"rect",
			"ellipse",
			"pen",
			"marker",
			"text",
			"step",
			"callout",
		] as ShapeType[]) {
			expect(shapeSupportsColor(type)).toBe(true);
		}
	});

	it("色を持たない図形（モザイク・ぼかし・スポットライト）は false", () => {
		for (const type of ["mosaic", "blur", "spotlight"] as ShapeType[]) {
			expect(shapeSupportsColor(type)).toBe(false);
		}
	});
});

describe("z 順変更（moveShape*）", () => {
	// 配列は「末尾が最前面」。a=最背面, c=最前面。
	it("moveShapeForward は 1 つ前面（末尾方向）へ動かす", () => {
		const next = moveShapeForward(docOf("a", "b", "c"), "a");
		expect(next.shapes.map((s) => s.id)).toEqual(["b", "a", "c"]);
	});

	it("moveShapeForward: 既に最前面なら同一参照を返す", () => {
		const doc = docOf("a", "b", "c");
		expect(moveShapeForward(doc, "c")).toBe(doc);
	});

	it("moveShapeBackward は 1 つ背面（先頭方向）へ動かす", () => {
		const next = moveShapeBackward(docOf("a", "b", "c"), "c");
		expect(next.shapes.map((s) => s.id)).toEqual(["a", "c", "b"]);
	});

	it("moveShapeBackward: 既に最背面なら同一参照を返す", () => {
		const doc = docOf("a", "b", "c");
		expect(moveShapeBackward(doc, "a")).toBe(doc);
	});

	it("moveShapeToFront は末尾へ動かす", () => {
		const next = moveShapeToFront(docOf("a", "b", "c"), "a");
		expect(next.shapes.map((s) => s.id)).toEqual(["b", "c", "a"]);
	});

	it("moveShapeToFront: 既に最前面なら同一参照を返す", () => {
		const doc = docOf("a", "b", "c");
		expect(moveShapeToFront(doc, "c")).toBe(doc);
	});

	it("moveShapeToBack は先頭へ動かす", () => {
		const next = moveShapeToBack(docOf("a", "b", "c"), "c");
		expect(next.shapes.map((s) => s.id)).toEqual(["c", "a", "b"]);
	});

	it("moveShapeToBack: 既に最背面なら同一参照を返す", () => {
		const doc = docOf("a", "b", "c");
		expect(moveShapeToBack(doc, "a")).toBe(doc);
	});

	it("対象 id が無ければ同一参照の doc を返す", () => {
		const doc = docOf("a", "b", "c");
		expect(moveShapeForward(doc, "x")).toBe(doc);
		expect(moveShapeBackward(doc, "x")).toBe(doc);
		expect(moveShapeToFront(doc, "x")).toBe(doc);
		expect(moveShapeToBack(doc, "x")).toBe(doc);
	});

	it("元の doc を変更しない（immutable）", () => {
		const doc = docOf("a", "b", "c");
		moveShapeForward(doc, "a");
		expect(doc.shapes.map((s) => s.id)).toEqual(["a", "b", "c"]);
	});

	it("crop を保持する", () => {
		const doc = setCrop(docOf("a", "b"), { x: 1, y: 2, width: 3, height: 4 });
		expect(moveShapeForward(doc, "a").crop).toEqual({
			x: 1,
			y: 2,
			width: 3,
			height: 4,
		});
	});
});

describe("translateShape", () => {
	it("x/y を持つ図形は x/y をずらす", () => {
		const moved = translateShape(rect("a", 10), 5, 7) as RectShape;
		expect(moved.x).toBe(15);
		expect(moved.y).toBe(7);
	});

	it("points 列を持つ図形（矢印）は全点をずらす", () => {
		const moved = translateShape(arrow("a", 0), 5, 7) as ArrowShape;
		// [0,0,10,10] → x に +5, y に +7
		expect(moved.points).toEqual([5, 7, 15, 17]);
	});

	it("元の図形を変更しない（immutable）", () => {
		const original = rect("a", 10);
		translateShape(original, 5, 7);
		expect(original.x).toBe(10);
	});
});

describe("duplicateShape", () => {
	it("新 id・既定オフセット（+16/+16）で複製する", () => {
		const dup = duplicateShape(rect("a", 10), "a2", [
			rect("a", 10),
		]) as RectShape;
		expect(dup.id).toBe("a2");
		expect(dup.x).toBe(26);
		expect(dup.y).toBe(16);
	});

	it("step バッジは次の連番を採る（同番号の重複を作らない）", () => {
		const base = [step("s1", 1), step("s2", 2)];
		const dup = duplicateShape(base[1] as StepShape, "s3", base) as StepShape;
		// 既存最大 2 の次 = 3
		expect(dup.number).toBe(3);
		expect(dup.id).toBe("s3");
	});

	it("テキストは文言ごと複製する", () => {
		const dup = duplicateShape(text("t"), "t2", [text("t")]) as TextShape;
		expect(dup.text).toBe("こんにちは");
		expect(dup.id).toBe("t2");
	});

	it("矢印は points をオフセットして複製する", () => {
		const dup = duplicateShape(arrow("a", 0), "a2", [
			arrow("a", 0),
		]) as ArrowShape;
		expect(dup.points).toEqual([16, 16, 26, 26]);
	});
});
