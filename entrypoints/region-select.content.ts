import { normalizeRect } from "@/lib/geometry";
import type { Message } from "@/lib/messages";
import { theme } from "@/lib/theme";

/** これ未満のドラッグはクリック扱いでキャンセルする。 */
const MIN_DRAG_PX = 4;

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
	const badge = document.createElement("div");
	badge.className = "badge";
	const hint = document.createElement("div");
	hint.className = "hint";
	// ドラッグ前の初期案内。ドラッグ開始後は「Esc でキャンセル」に切り替えて出し続ける。
	const HINT_IDLE = "ドラッグで範囲選択 / Esc でキャンセル";
	const HINT_DRAGGING = "Esc でキャンセル";
	hint.textContent = HINT_IDLE;
	shadow.append(style, backdrop, selection, badge, hint);

	let dragging = false;
	let startX = 0;
	let startY = 0;

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
		backdrop.classList.add("dragging");
		backdrop.setPointerCapture(e.pointerId);
		// ドラッグ中も操作方法が分かるよう、ヒントは消さず「Esc でキャンセル」に切り替える。
		hint.textContent = HINT_DRAGGING;
		update(e);
	};

	const onPointerMove = (e: PointerEvent): void => {
		if (!dragging) return;
		e.preventDefault();
		update(e);
	};

	const onPointerUp = (e: PointerEvent): void => {
		if (!dragging) return;
		e.preventDefault();
		const rect = normalizeRect(startX, startY, e.clientX, e.clientY);
		if (rect.width < MIN_DRAG_PX || rect.height < MIN_DRAG_PX) {
			cancel();
			return;
		}
		const viewport = {
			width: window.innerWidth,
			height: window.innerHeight,
		};
		// オーバーレイを DOM から完全に除去し、描画へ反映させてからキャプチャさせる。
		// rAF を 2 回待つことで暗幕がスクリーンショットに写り込むのを防ぐ。順序厳守。
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
		}
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
		host.remove();
		onDispose();
	};

	backdrop.addEventListener("pointerdown", onPointerDown);
	backdrop.addEventListener("pointermove", onPointerMove);
	backdrop.addEventListener("pointerup", onPointerUp);
	window.addEventListener("keydown", onKeyDown, true);

	document.documentElement.appendChild(host);
}
