/**
 * トーストの種類。既定は success（成功系。現状スタイルを維持）。
 * error は失敗系で、左ボーダーと背景トーンを danger トークンで差別化する。
 */
export type ToastVariant = "success" | "error";

/**
 * エディタ内の軽量トースト。操作の成功・失敗を短く知らせる。
 *
 * aria-live="polite" でスクリーンリーダーに読み上げさせ、フォーカスは奪わない。
 * 3 秒で自動消滅し、prefers-reduced-motion では出現アニメーションを省く。
 * 失敗（error）でも aria-live は polite のまま（割り込みで読み上げを奪わない）。
 */
export class Toast {
	private container: HTMLDivElement;
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(parent: HTMLElement) {
		this.container = document.createElement("div");
		this.container.className = "toast-region";
		this.container.setAttribute("aria-live", "polite");
		// フォーカスを奪わないよう純粋な通知領域にとどめる。
		parent.appendChild(this.container);
	}

	/**
	 * メッセージを表示する。連続呼び出しは最新の 1 件で上書きする。
	 * variant で成功（既定）/ 失敗の見た目を切り替える（挙動・自動消滅は共通）。
	 */
	show(message: string, variant: ToastVariant = "success"): void {
		this.container.textContent = "";
		const item = document.createElement("div");
		item.className = variant === "error" ? "toast toast-error" : "toast";
		item.textContent = message;
		this.container.appendChild(item);

		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			item.classList.add("toast-leaving");
			// フェードアウト後に除去（reduced-motion なら即時扱いでも問題ない）。
			setTimeout(() => item.remove(), 200);
		}, 3000);
	}
}
