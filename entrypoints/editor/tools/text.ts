import {
	addShape,
	findShape,
	removeShape,
	type Shape,
	type TextShape,
	updateShape,
} from "@/lib/editor/doc";
import type { Point } from "../geometry-view";
import type { EditorContext, Tool, ToolName } from "./types";

/** 新規テキストの初期フォントサイズ（ドキュメント座標系の px）。 */
const DEFAULT_FONT_SIZE = 24;

/**
 * テキストツール。
 * - クリックで新規テキストを配置し即編集モードに入る。
 * - 図形の dblclick で既存テキストを再編集する。
 * 編集は body 直下に絶対配置した textarea オーバーレイで行い、位置・フォントサイズは
 * ズーム率に追従する。Enter 確定 / Shift+Enter 改行 / Esc キャンセル。
 *
 * 編集中は doc を一切いじらず、確定時に 1 回だけ addShape/updateShape する
 * （空文字確定は図形化しない）。これにより空テキストが履歴に残らない。
 */
export class TextTool implements Tool {
	readonly name: ToolName = "text";
	private overlay: HTMLTextAreaElement | null = null;

	constructor(private ctx: EditorContext) {}

	onPointerDown(pos: Point): void {
		if (this.overlay) return; // 編集中は blur による確定を優先
		const shape: TextShape = {
			id: this.ctx.newId(),
			type: "text",
			x: pos.x,
			y: pos.y,
			text: "",
			fontSize: DEFAULT_FONT_SIZE,
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
		this.overlay?.blur(); // 別ツールへ切り替わるときは確定
	}

	/** 既存テキストの再編集を開く。 */
	editExisting(id: string): void {
		if (this.overlay) return;
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
		this.ctx.setTextEditing(true);
		if (mode === "existing") this.ctx.setNodeVisible(shape.id, false);

		const scale = this.ctx.scale();
		const client = this.ctx.docToClient({ x: shape.x, y: shape.y });

		const ta = document.createElement("textarea");
		ta.className = "text-overlay";
		ta.value = shape.text;
		ta.style.left = `${client.x}px`;
		ta.style.top = `${client.y}px`;
		ta.style.fontSize = `${shape.fontSize * scale}px`;
		ta.style.color = shape.stroke;
		document.body.append(ta);
		this.overlay = ta;
		this.autoSize(ta);

		ta.focus();
		ta.setSelectionRange(ta.value.length, ta.value.length);

		let settled = false;
		const finish = (commitText: boolean): void => {
			if (settled) return;
			settled = true;
			const text = ta.value;
			ta.remove();
			this.overlay = null;
			this.ctx.setTextEditing(false);

			const trimmedEmpty = text.trim().length === 0;

			if (mode === "new") {
				if (commitText && !trimmedEmpty) {
					this.ctx.commitDoc(addShape(this.ctx.getDoc(), { ...shape, text }));
				}
				// キャンセル or 空: 何も追加しない（doc は元のまま）。
				return;
			}

			// mode === "existing"
			const exists = findShape(this.ctx.getDoc(), shape.id);
			if (!exists) return;
			if (!commitText) {
				// キャンセル: 元ノードを再表示するだけ。
				this.ctx.setNodeVisible(shape.id, true);
			} else if (trimmedEmpty) {
				// 空にした確定は図形削除。
				this.ctx.commitDoc(removeShape(this.ctx.getDoc(), shape.id));
			} else {
				this.ctx.commitDoc(updateShape(this.ctx.getDoc(), shape.id, { text }));
			}
		};

		ta.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				finish(true);
			} else if (e.key === "Escape") {
				e.preventDefault();
				finish(false);
			}
			// 編集中の他キーはエディタ側ショートカットに漏らさない。
			e.stopPropagation();
		});
		ta.addEventListener("input", () => this.autoSize(ta));
		ta.addEventListener("blur", () => finish(true));
	}

	/** textarea の内容量に合わせて幅・高さを広げる。 */
	private autoSize(ta: HTMLTextAreaElement): void {
		ta.style.width = "0";
		ta.style.height = "0";
		ta.style.width = `${ta.scrollWidth + 4}px`;
		ta.style.height = `${ta.scrollHeight}px`;
	}
}
