/**
 * エディタ内の軽量トースト。操作の成功を短く知らせる。
 *
 * aria-live="polite" でスクリーンリーダーに読み上げさせ、フォーカスは奪わない。
 * 3 秒で自動消滅し、prefers-reduced-motion では出現アニメーションを省く。
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

	/** メッセージを表示する。連続呼び出しは最新の 1 件で上書きする。 */
	show(message: string): void {
		this.container.textContent = "";
		const item = document.createElement("div");
		item.className = "toast";
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
