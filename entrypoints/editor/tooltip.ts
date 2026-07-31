import { placeTooltip } from "@/lib/editor/tooltip";

/** ホバーから表示までのディレイ（ms）。即出しはうるさいので少し待つ。 */
const SHOW_DELAY_MS = 400;

/**
 * 単一の要素を使い回すカスタムツールチップ。
 *
 * ルート要素にイベントを委譲し、`data-tooltip` を持つ子孫を対象に
 * ホバー/フォーカスで本文（＋任意の `data-shortcut`）を表示する。
 * - 位置はボタンの真下・中央揃え。画面端は placeTooltip がクランプする。
 * - ホバーは SHOW_DELAY_MS 待ってからフェードイン、離脱・クリックで即消し。
 * - focus でも出す（キーボード操作）。role="tooltip"・aria-hidden を切替える。
 * - 見た目のトランジションは CSS 側。prefers-reduced-motion は CSS が無効化する。
 */
export class Tooltip {
	private el: HTMLDivElement;
	private body: HTMLSpanElement;
	private key: HTMLSpanElement;
	private caret: HTMLSpanElement;
	private showTimer: ReturnType<typeof setTimeout> | null = null;
	/** 現在ツールチップを出している対象（重複表示・多重フェードを避ける）。 */
	private current: HTMLElement | null = null;
	/** schedule 中の対象（まだ表示前）。onOut での取り消し判定に使う。 */
	private pending: HTMLElement | null = null;

	constructor(private root: HTMLElement) {
		this.el = document.createElement("div");
		this.el.className = "tooltip";
		this.el.setAttribute("role", "tooltip");
		this.el.setAttribute("aria-hidden", "true");

		this.caret = document.createElement("span");
		this.caret.className = "tooltip-caret";
		this.body = document.createElement("span");
		this.body.className = "tooltip-body";
		this.key = document.createElement("span");
		this.key.className = "tooltip-key";
		this.el.append(this.caret, this.body, this.key);
		// ツールバーの外（body 直下）に置く。ツールバーの overflow やスタッキング
		// 文脈に閉じ込められず、画面端クランプもビューポート基準で素直に効く。
		document.body.appendChild(this.el);

		// mouseenter/leave・focus/blur はバブリングしないので capture で委譲する。
		this.root.addEventListener("mouseover", this.onOver, true);
		this.root.addEventListener("mouseout", this.onOut, true);
		this.root.addEventListener("focusin", this.onOver, true);
		this.root.addEventListener("focusout", this.onOut, true);
		// クリックしたら即消す（選択後にツールチップが残らないように）。
		this.root.addEventListener("click", this.hide, true);
		// ドラッグ等でポインタが押されたら消す。
		this.root.addEventListener("pointerdown", this.hide, true);
	}

	private onOver = (e: Event): void => {
		const target = this.resolveTarget(e.target);
		if (!target || target === this.current) return;
		this.schedule(target);
	};

	private onOut = (e: Event): void => {
		const target = this.resolveTarget(e.target);
		if (!target) return;
		// 対象内での要素間移動（アイコン→ボタン等）では消さない。
		const related = (e as MouseEvent | FocusEvent).relatedTarget;
		if (related instanceof Node && target.contains(related)) return;
		if (target === this.current || target === this.pending) this.hide();
	};

	/** ツールチップ対象（data-tooltip を持つ最寄りの要素）を探す。 */
	private resolveTarget(node: EventTarget | null): HTMLElement | null {
		if (!(node instanceof Element)) return null;
		const el = node.closest<HTMLElement>("[data-tooltip]");
		return el && this.root.contains(el) ? el : null;
	}

	private schedule(target: HTMLElement): void {
		this.clearTimer();
		this.pending = target;
		this.showTimer = setTimeout(() => this.render(target), SHOW_DELAY_MS);
	}

	private render(target: HTMLElement): void {
		this.pending = null;
		const body = target.dataset.tooltip ?? "";
		if (!body) return;
		const shortcut = target.dataset.shortcut ?? "";

		this.body.textContent = body;
		if (shortcut) {
			this.key.textContent = shortcut;
			this.key.hidden = false;
		} else {
			this.key.textContent = "";
			this.key.hidden = true;
		}

		// 一旦可視属性を付けて実サイズを測ってから配置する（幅は内容依存）。
		this.el.setAttribute("data-visible", "");
		this.el.setAttribute("aria-hidden", "false");
		this.current = target;

		const rect = target.getBoundingClientRect();
		const { left, top, caretLeft } = placeTooltip({
			targetLeft: rect.left,
			targetRight: rect.right,
			targetBottom: rect.bottom,
			tooltipWidth: this.el.offsetWidth,
			viewportWidth: window.innerWidth,
		});
		this.el.style.left = `${left}px`;
		this.el.style.top = `${top}px`;
		this.caret.style.left = `${caretLeft}px`;
	}

	private hide = (): void => {
		this.clearTimer();
		this.pending = null;
		this.current = null;
		this.el.removeAttribute("data-visible");
		this.el.setAttribute("aria-hidden", "true");
	};

	private clearTimer(): void {
		if (this.showTimer) {
			clearTimeout(this.showTimer);
			this.showTimer = null;
		}
	}
}
