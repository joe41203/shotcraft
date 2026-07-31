/**
 * undo/redo のためのスナップショット履歴。
 *
 * 状態そのもの（present）と、確定済みの過去（past）・やり直し用の未来（future）を
 * 持つ純粋なデータ構造。ドラッグ中の中間状態は commit せず、操作確定時に 1 回だけ
 * commit することで履歴が中間状態で埋まらないようにする（呼び出し側の責務）。
 */

export interface History<T> {
	past: T[];
	present: T;
	future: T[];
}

/** past に保持する最大件数。超過時は最古から捨てる。 */
export const MAX_HISTORY = 50;

/** present だけを持つ初期履歴を作る。 */
export function initHistory<T>(present: T): History<T> {
	return { past: [], present, future: [] };
}

/**
 * 現在の present を past に積み、next を新しい present にする。
 * 新規操作なので future（やり直し）はクリアする。
 * past が上限を超えたら最古を捨てる。
 */
export function commit<T>(history: History<T>, next: T): History<T> {
	const past = [...history.past, history.present];
	if (past.length > MAX_HISTORY) {
		past.splice(0, past.length - MAX_HISTORY);
	}
	return { past, present: next, future: [] };
}

export function canUndo<T>(history: History<T>): boolean {
	return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
	return history.future.length > 0;
}

/**
 * 1 つ前の状態に戻す。past が空なら何もせずそのまま返す。
 * 現在の present は future の先頭へ退避する。
 */
export function undo<T>(history: History<T>): History<T> {
	if (!canUndo(history)) return history;
	const past = history.past.slice(0, -1);
	const present = history.past[history.past.length - 1] as T;
	return { past, present, future: [history.present, ...history.future] };
}

/**
 * 1 つ先の状態に進める。future が空なら何もせずそのまま返す。
 * 現在の present は past の末尾へ積む。
 */
export function redo<T>(history: History<T>): History<T> {
	if (!canRedo(history)) return history;
	const present = history.future[0] as T;
	const future = history.future.slice(1);
	return { past: [...history.past, history.present], present, future };
}
