import {
	CLICK_MOVE_THRESHOLD_PX,
	elementRectToSnapRect,
	isClick,
} from "@/lib/element-snap";
import { normalizeRect } from "@/lib/geometry";
import type { Message, Rect } from "@/lib/messages";
import { theme } from "@/lib/theme";

/** これ未満のドラッグはクリック扱いにする（要素スナップ確定 / 自由選択の分岐しきい値）。 */
const MIN_DRAG_PX = CLICK_MOVE_THRESHOLD_PX;

/**
 * 再注入検知用の window センチネル。content script は isolated world で動くので
 * ページや他拡張の変数とは干渉しない。
 */
const SENTINEL = "__shotcraftRegionSelect";

export default defineContentScript({
	registration: "runtime",
	main() {
		const w = window as unknown as Record<string, unknown>;
		// 二重注入ガード: 既に起動中なら何もしない
		if (w[SENTINEL]) return;
		w[SENTINEL] = true;
		startOverlay(() => {
			delete w[SENTINEL];
		});
	},
});

function send(message: Message): void {
	void browser.runtime.sendMessage(message);
}

function startOverlay(onDispose: () => void): void {
	// スタイル隔離のため Shadow DOM を使い、ホストは inline style で最前面に固定する
	const host = document.createElement("div");
	host.style.cssText =
		"position:fixed;inset:0;margin:0;padding:0;border:0;z-index:2147483647;";
	const shadow = host.attachShadow({ mode: "closed" });

	const style = document.createElement("style");
	// 色は lib/theme.ts のトークンを参照する。Shadow DOM は拡張ページの
	// CSS 変数を参照できないため、TS 定数から値を埋め込む。
	style.textContent = `
    .backdrop {
      position: fixed; inset: 0;
      cursor: crosshair;
      background: rgba(3, 6, 12, 0.5);
      touch-action: none;
    }
    .backdrop.dragging { background: transparent; }
    .selection {
      position: fixed;
      display: none;
      border: 1px solid ${theme.ring};
      background: transparent;
      /* 選択領域だけ明るく抜き、それ以外を暗幕で覆う（scrim は 50% 前後） */
      box-shadow: 0 0 0 100000px rgba(3, 6, 12, 0.5);
      pointer-events: none;
    }
    /* 要素スナップのホバーハイライト。DevTools のインスペクタ風に半透明の塗り＋枠線。
       選択矩形（.selection）と同系のトーンで、塗りは選択色 ring を薄く敷く。 */
    .highlight {
      position: fixed;
      display: none;
      border: 1px solid ${theme.ring};
      background: rgba(56, 189, 248, 0.18);
      pointer-events: none;
    }
    .badge {
      position: fixed;
      display: none;
      transform: translateY(8px);
      background: ${theme.surface2}; color: ${theme.text};
      border: 1px solid ${theme.border};
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      font: 12px/1.6 ${theme.fontSans};
      font-variant-numeric: tabular-nums;
      padding: 2px 8px; border-radius: 8px;
      pointer-events: none;
      white-space: nowrap;
    }
    .hint {
      position: fixed; top: 12px; left: 50%;
      transform: translateX(-50%);
      background: ${theme.surface2}; color: ${theme.text};
      border: 1px solid ${theme.border};
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      font: 12px/2 ${theme.fontSans};
      padding: 2px 12px; border-radius: 10px;
      pointer-events: none;
    }
  `;

	const backdrop = document.createElement("div");
	backdrop.className = "backdrop";
	const selection = document.createElement("div");
	selection.className = "selection";
	// 要素スナップ用のホバーハイライト。選択矩形とは別要素にして重ならないよう出し分ける。
	const highlight = document.createElement("div");
	highlight.className = "highlight";
	const badge = document.createElement("div");
	badge.className = "badge";
	const hint = document.createElement("div");
	hint.className = "hint";
	// ドラッグ前の初期案内。ドラッグ開始後は「Esc でキャンセル」に切り替えて出し続ける。
	const HINT_IDLE =
		"クリックで要素を選択 / ドラッグで範囲選択 / Esc でキャンセル";
	const HINT_DRAGGING = "Esc でキャンセル";
	hint.textContent = HINT_IDLE;
	shadow.append(style, backdrop, selection, highlight, badge, hint);

	let dragging = false;
	let startX = 0;
	let startY = 0;
	// 直近のホバーハイライト矩形（CSS px）。クリック確定時にこれを送る。null なら対象なし。
	let hoverRect: Rect | null = null;
	// Alt（Option）押下で親要素へ 1 段階拡大するかどうか。
	let expandToParent = false;
	// pointermove ごとに再取得した「カーソル下の最深要素」。Alt トグル時の再計算に使う。
	let lastTarget: Element | null = null;
	let lastPointerX = 0;
	let lastPointerY = 0;

	// --- 要素スナップ（ホバーハイライト） ---

	/**
	 * カーソル位置の下にある「ページ側の」要素を返す。
	 * オーバーレイのホストに一時的に pointer-events:none を立て、elementFromPoint が
	 * オーバーレイ自身でなくその下の要素を拾えるようにする（closed shadow のため
	 * ホストさえ透過させれば内部要素も巻き込まない）。取得後は必ず元へ戻す。
	 */
	const elementUnderCursor = (x: number, y: number): Element | null => {
		const prev = host.style.pointerEvents;
		host.style.pointerEvents = "none";
		const el = document.elementFromPoint(x, y);
		host.style.pointerEvents = prev;
		// 念のためホスト自身が返ってきたら対象外（通常は透過済みで起こらない）。
		if (!el || el === host) return null;
		return el;
	};

	/**
	 * 最深要素から出発し、Alt 押下時は親へ 1 段階だけ広げた対象要素を返す。
	 * html / body は範囲が広すぎてスナップの意味が薄いため対象外にする。
	 */
	const resolveTarget = (deepest: Element | null): Element | null => {
		if (!deepest) return null;
		let target = deepest;
		if (expandToParent && target.parentElement) {
			target = target.parentElement;
		}
		if (target === document.documentElement || target === document.body) {
			return null;
		}
		return target;
	};

	/** 対象要素の矩形をハイライト表示に反映する（対象外なら消す）。 */
	const applyHighlight = (target: Element | null): void => {
		const viewport = { width: window.innerWidth, height: window.innerHeight };
		const domRect = target?.getBoundingClientRect();
		const rect = domRect ? elementRectToSnapRect(domRect, viewport) : null;
		hoverRect = rect;
		if (!rect) {
			highlight.style.display = "none";
			badge.style.display = "none";
			return;
		}
		highlight.style.display = "block";
		highlight.style.left = `${rect.x}px`;
		highlight.style.top = `${rect.y}px`;
		highlight.style.width = `${rect.width}px`;
		highlight.style.height = `${rect.height}px`;
		badge.style.display = "block";
		badge.textContent = `${Math.round(rect.width)} x ${Math.round(rect.height)}`;
		badge.style.left = `${rect.x}px`;
		badge.style.top = `${Math.min(rect.y + rect.height, window.innerHeight - 32)}px`;
	};

	/** カーソル位置から要素を検出し直してハイライトを更新する。 */
	const updateHover = (x: number, y: number): void => {
		lastPointerX = x;
		lastPointerY = y;
		lastTarget = elementUnderCursor(x, y);
		applyHighlight(resolveTarget(lastTarget));
	};

	// --- 自由範囲選択（ドラッグ） ---

	const update = (e: PointerEvent): void => {
		const rect = normalizeRect(startX, startY, e.clientX, e.clientY);
		selection.style.display = "block";
		selection.style.left = `${rect.x}px`;
		selection.style.top = `${rect.y}px`;
		selection.style.width = `${rect.width}px`;
		selection.style.height = `${rect.height}px`;
		badge.style.display = "block";
		badge.textContent = `${rect.width} x ${rect.height}`;
		badge.style.left = `${rect.x}px`;
		badge.style.top = `${Math.min(rect.y + rect.height, window.innerHeight - 32)}px`;
	};

	const onPointerDown = (e: PointerEvent): void => {
		if (e.button !== 0) return;
		e.preventDefault();
		dragging = true;
		startX = e.clientX;
		startY = e.clientY;
		backdrop.setPointerCapture(e.pointerId);
		// ドラッグ開始時点ではまだクリックの可能性がある。ドラッグと確定するまで
		// 暗幕・ヒントは切り替えず、ホバーハイライトも残しておく（微動でのちらつき防止）。
	};

	const onPointerMove = (e: PointerEvent): void => {
		if (!dragging) {
			// 未ドラッグ時はカーソル下の要素を追ってハイライトする。
			updateHover(e.clientX, e.clientY);
			return;
		}
		e.preventDefault();
		// 閾値未満の微動はまだクリック候補。ハイライトのまま自由選択へ切り替えない。
		if (isClick(startX, startY, e.clientX, e.clientY, MIN_DRAG_PX)) return;
		// ここで初めて自由範囲選択へ移行する。ホバーハイライトを畳み暗幕を透明化する。
		if (highlight.style.display !== "none") {
			highlight.style.display = "none";
			hoverRect = null;
		}
		if (!backdrop.classList.contains("dragging")) {
			backdrop.classList.add("dragging");
			hint.textContent = HINT_DRAGGING;
		}
		update(e);
	};

	const onPointerUp = (e: PointerEvent): void => {
		if (!dragging) return;
		e.preventDefault();
		dragging = false;
		const viewport = {
			width: window.innerWidth,
			height: window.innerHeight,
		};
		// クリック（ほぼ移動なし）なら要素スナップ確定。ハイライト中の矩形を送る。
		if (isClick(startX, startY, e.clientX, e.clientY, MIN_DRAG_PX)) {
			const rect = hoverRect;
			if (!rect) {
				// クリックしたが対象要素なし（極小・画面外など）。何もせず継続。
				return;
			}
			commitRect(rect, viewport);
			return;
		}
		// ドラッグ確定（自由範囲選択）。
		const rect = normalizeRect(startX, startY, e.clientX, e.clientY);
		if (rect.width < MIN_DRAG_PX || rect.height < MIN_DRAG_PX) {
			cancel();
			return;
		}
		commitRect(rect, viewport);
	};

	/**
	 * 選択矩形を確定して REGION_SELECTED を送る（要素スナップ・自由選択で共通）。
	 * オーバーレイを DOM から完全に除去し、描画へ反映させてからキャプチャさせる。
	 * rAF を 2 回待つことで暗幕・ハイライトがスクリーンショットに写り込むのを防ぐ。順序厳守。
	 */
	const commitRect = (
		rect: Rect,
		viewport: { width: number; height: number },
	): void => {
		cleanup();
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				send({ type: "REGION_SELECTED", rect, viewport });
			});
		});
	};

	const onKeyDown = (e: KeyboardEvent): void => {
		if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			cancel();
			return;
		}
		// Alt（Option）押下中は親要素へ 1 段階拡大する。ドラッグ中は無効。
		if (e.key === "Alt" && !dragging && !expandToParent) {
			expandToParent = true;
			applyHighlight(resolveTarget(lastTarget));
		}
	};

	const onKeyUp = (e: KeyboardEvent): void => {
		if (e.key === "Alt" && expandToParent) {
			expandToParent = false;
			if (!dragging) applyHighlight(resolveTarget(lastTarget));
		}
	};

	// スクロールで要素とカーソルの相対位置がずれるため、最後のカーソル位置で取り直す。
	const onScroll = (): void => {
		if (dragging) return;
		updateHover(lastPointerX, lastPointerY);
	};

	const cancel = (): void => {
		cleanup();
		send({ type: "REGION_CANCELLED" });
	};

	const cleanup = (): void => {
		backdrop.removeEventListener("pointerdown", onPointerDown);
		backdrop.removeEventListener("pointermove", onPointerMove);
		backdrop.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("keydown", onKeyDown, true);
		window.removeEventListener("keyup", onKeyUp, true);
		window.removeEventListener("scroll", onScroll, true);
		host.remove();
		onDispose();
	};

	backdrop.addEventListener("pointerdown", onPointerDown);
	backdrop.addEventListener("pointermove", onPointerMove);
	backdrop.addEventListener("pointerup", onPointerUp);
	window.addEventListener("keydown", onKeyDown, true);
	window.addEventListener("keyup", onKeyUp, true);
	// スクロール追従（capture: ページ内スクロールコンテナの scroll も拾う）。
	window.addEventListener("scroll", onScroll, true);

	document.documentElement.appendChild(host);
}
