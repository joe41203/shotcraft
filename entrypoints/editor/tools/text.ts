import {
	addShape,
	findShape,
	removeShape,
	type Shape,
	type TextShape,
	updateShape,
} from "@/lib/editor/doc";
import { TEXT_LINE_HEIGHT } from "@/lib/editor/text";
import { theme } from "@/lib/theme";
import type { Point } from "../geometry-view";
import { openTextOverlay } from "./text-overlay";
import type { EditorContext, Tool, ToolName } from "./types";

/**
 * テキストツール。
 * - クリックで新規テキストを配置し即編集モードに入る。
 * - 図形の dblclick で既存テキストを再編集する。
 * 編集は body 直下に絶対配置した textarea オーバーレイ（openTextOverlay）で行い、
 * 位置・フォントサイズはズーム率に追従する。Enter は改行、確定は Cmd/Ctrl+Enter・Esc・
 * 入力欄外クリック（キー割り当ての理由は openTextOverlay のコメントを参照）。
 *
 * 編集中は doc を一切いじらず、確定時に 1 回だけ addShape/updateShape する
 * （空文字確定は図形化しない）。これにより空テキストが履歴に残らない。
 */
export class TextTool implements Tool {
	readonly name: ToolName = "text";
	private editing = false;

	constructor(private ctx: EditorContext) {}

	onPointerDown(pos: Point): void {
		if (this.editing) return; // 編集中は blur による確定を優先
		const shape: TextShape = {
			id: this.ctx.newId(),
			type: "text",
			x: pos.x,
			y: pos.y,
			text: "",
			fontSize: this.ctx.style.fontSize,
			stroke: this.ctx.style.stroke,
			strokeWidth: this.ctx.style.strokeWidth,
			rotation: 0,
			opacity: 1,
		};
		this.openOverlay(shape, "new");
	}

	onDblClick(shape: Shape): void {
		if (shape.type !== "text") return;
		this.editExisting(shape.id);
	}

	deactivate(): void {
		// 別ツールへ切り替わるときの確定は openTextOverlay の blur が担う。
	}

	/** 既存テキストの再編集を開く。 */
	editExisting(id: string): void {
		if (this.editing) return;
		const shape = findShape(this.ctx.getDoc(), id);
		if (!shape || shape.type !== "text") return;
		this.openOverlay(shape, "existing");
	}

	/**
	 * textarea オーバーレイを開く。
	 * mode="new": 確定でテキストがあれば addShape、無ければ何もしない。
	 * mode="existing": 元図形を編集中は隠し、確定で updateShape（空なら削除）。
	 */
	private openOverlay(shape: TextShape, mode: "new" | "existing"): void {
		this.editing = true;
		if (mode === "existing") this.ctx.setNodeVisible(shape.id, false);

		openTextOverlay(
			this.ctx,
			{
				value: shape.text,
				docPos: { x: shape.x, y: shape.y },
				fontSize: shape.fontSize,
				// render.ts の Konva.Text と同じ固定スタックを使い、編集中と確定後の見た目を一致させる。
				fontFamily: theme.fontAnnotation,
				color: shape.stroke,
				lineHeight: TEXT_LINE_HEIGHT,
			},
			(text) => {
				this.editing = false;
				this.finish(shape, mode, text);
			},
		);
	}

	/** オーバーレイ確定/キャンセルの結果を doc へ反映する。 */
	private finish(
		shape: TextShape,
		mode: "new" | "existing",
		text: string | null,
	): void {
		const trimmedEmpty = text == null || text.trim().length === 0;

		if (mode === "new") {
			if (text != null && !trimmedEmpty) {
				this.ctx.commitDoc(addShape(this.ctx.getDoc(), { ...shape, text }));
			}
			// キャンセル or 空: 何も追加しない（doc は元のまま）。
			return;
		}

		// mode === "existing"
		const exists = findShape(this.ctx.getDoc(), shape.id);
		if (!exists) return;
		if (text == null) {
			// キャンセル: 元ノードを再表示するだけ。
			this.ctx.setNodeVisible(shape.id, true);
		} else if (trimmedEmpty) {
			// 空にした確定は図形削除。
			this.ctx.commitDoc(removeShape(this.ctx.getDoc(), shape.id));
		} else {
			this.ctx.commitDoc(updateShape(this.ctx.getDoc(), shape.id, { text }));
		}
	}
}
