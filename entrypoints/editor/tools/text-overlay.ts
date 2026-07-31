import type { EditorContext } from "./types";

/** テキスト編集オーバーレイの初期表示パラメータ。 */
export interface TextOverlayOptions {
	/** 初期テキスト。 */
	value: string;
	/** 配置するドキュメント座標（左上）。 */
	docPos: { x: number; y: number };
	/** フォントサイズ（ドキュメント座標系。ズームは内部で掛ける）。 */
	fontSize: number;
	/** CSS の font-family スタック文字列。 */
	fontFamily: string;
	/** 文字色（CSS カラー）。 */
	color: string;
	/** textarea の折返し幅（ドキュメント座標系 px）。省略時は内容に合わせて広げる。 */
	wrapWidth?: number;
}

/**
 * キャンバス上に textarea オーバーレイを出してテキストを編集する共通機構。
 * text ツールと callout ツールで共有する。位置・フォントサイズはズーム率に追従し、
 * Enter 確定 / Shift+Enter 改行 / Esc キャンセル / blur 確定（次フレーム以降）。
 *
 * 確定時は onFinish(text) を、キャンセル時は onFinish(null) を 1 回だけ呼ぶ。
 * doc の書き込みは呼び出し側が onFinish の中で行う（この機構は doc に触れない）。
 * setTextEditing はここで面倒を見る（ショートカット抑止）。
 */
export function openTextOverlay(
	ctx: EditorContext,
	options: TextOverlayOptions,
	onFinish: (text: string | null) => void,
): void {
	ctx.setTextEditing(true);

	const scale = ctx.scale();
	const client = ctx.docToClient(options.docPos);

	const ta = document.createElement("textarea");
	ta.className = "text-overlay";
	ta.value = options.value;
	ta.style.left = `${client.x}px`;
	ta.style.top = `${client.y}px`;
	ta.style.fontSize = `${options.fontSize * scale}px`;
	ta.style.fontFamily = options.fontFamily;
	ta.style.color = options.color;
	if (options.wrapWidth != null) {
		// 折返し幅を固定するときは pre-wrap にして幅を指定（callout の本体幅に合わせる）。
		ta.style.whiteSpace = "pre-wrap";
		ta.style.width = `${options.wrapWidth * scale}px`;
	}
	document.body.append(ta);

	const autoSize = (): void => {
		if (options.wrapWidth != null) {
			// 幅固定時は高さのみ内容に追従させる。
			ta.style.height = "0";
			ta.style.height = `${ta.scrollHeight}px`;
			return;
		}
		ta.style.width = "0";
		ta.style.height = "0";
		ta.style.width = `${ta.scrollWidth + 4}px`;
		ta.style.height = `${ta.scrollHeight}px`;
	};
	autoSize();

	let settled = false;
	const finish = (commit: boolean): void => {
		if (settled) return;
		settled = true;
		const text = ta.value;
		ta.remove();
		ctx.setTextEditing(false);
		onFinish(commit ? text : null);
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
	ta.addEventListener("input", autoSize);

	// blur 確定は生成の次フレーム以降のみ有効にする（生成直後の blur→即確定を防ぐ）。
	let allowBlur = false;
	requestAnimationFrame(() => {
		allowBlur = true;
	});
	ta.addEventListener("blur", () => {
		if (settled) return;
		if (allowBlur) finish(true);
		else ta.focus();
	});

	ta.focus();
	ta.setSelectionRange(ta.value.length, ta.value.length);
}
