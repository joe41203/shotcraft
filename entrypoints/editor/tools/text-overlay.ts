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
	/** 行高（フォントサイズ比）。確定後の Konva.Text と同じ値を渡す。 */
	lineHeight: number;
	/** textarea の折返し幅（ドキュメント座標系 px）。省略時は内容に合わせて広げる。 */
	wrapWidth?: number;
}

/**
 * 直後に来るキャンバス上の pointerdown を 1 回だけキャプチャ段階で握り潰す。
 * オーバーレイ外クリックでの確定時、その同じクリックがキャンバスへ届いて
 * 次の図形作成を始めてしまうのを防ぐ。
 *
 * ツールバー等キャンバス外のクリックは飲み込まない（ボタンが 1 回目の
 * クリックで反応しなくなるため）。クリック以外の理由で blur した場合に
 * 無関係な操作を食わないよう、次フレームで自動解除する。
 */
function swallowNextPointerDown(canvas: HTMLElement): void {
	const swallow = (e: Event): void => {
		cleanup();
		if (e.target instanceof Node && canvas.contains(e.target)) {
			e.stopPropagation();
		}
	};
	const cleanup = (): void => {
		window.removeEventListener("pointerdown", swallow, true);
	};
	window.addEventListener("pointerdown", swallow, true);
	requestAnimationFrame(cleanup);
}

/**
 * キャンバス上に textarea オーバーレイを出してテキストを編集する共通機構。
 * text ツールと callout ツールで共有する。位置・フォントサイズはズーム率に追従し、
 * Enter は改行、確定は Cmd/Ctrl+Enter・Esc・blur（次フレーム以降）。
 *
 * Enter を確定に割り当てると IME の変換確定 Enter で編集が閉じてしまい、
 * 日本語入力が事実上できなくなる。改行の方が高頻度な操作でもあるため
 * Enter は素直に改行とし、確定は明示的なキー/クリックに寄せている。
 *
 * 確定時は onFinish(text) を、キャンセル時は onFinish(null) を 1 回だけ呼ぶ。
 * 現状の割り当てにキャンセル操作は無い（Esc も確定）が、呼び出し側は null を
 * 「編集前の状態へ戻す」として扱えるよう契約として残している。
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
	// 確定後の Konva.Text と行高を揃える（改行時に行位置がずれないように）。
	ta.style.lineHeight = String(options.lineHeight);
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

	// IME 変換中フラグ。KeyboardEvent.isComposing だけに頼らず composition
	// イベントでも保持する（変換確定時の keydown で isComposing が false に
	// なる環境があり、その Enter を確定として拾うと日本語入力が壊れる）。
	let composing = false;
	ta.addEventListener("compositionstart", () => {
		composing = true;
	});
	ta.addEventListener("compositionend", () => {
		composing = false;
	});

	ta.addEventListener("keydown", (e) => {
		// IME 変換中のキーは textarea に丸投げする。
		if (!composing && !e.isComposing) {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				finish(true);
			} else if (e.key === "Escape") {
				e.preventDefault();
				finish(true);
			}
			// Enter 単独・Shift+Enter は改行（textarea の既定動作に任せる）。
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
		if (allowBlur) {
			// キャンバスをクリックして確定した場合、blur は同じクリックの
			// pointerdown より先に発火する。そのまま通すと「確定したのに
			// 同じクリックで次のテキストが開く」ため、直後の 1 回だけ飲み込む。
			swallowNextPointerDown(ctx.stage.container());
			finish(true);
		} else {
			ta.focus();
		}
	});

	ta.focus();
	ta.setSelectionRange(ta.value.length, ta.value.length);
}
