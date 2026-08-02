/**
 * 拡張アイコンのバッジに出す進捗文字列の整形（純粋関数）。
 *
 * バッジは実質 4 文字程度しか収まらないため、タイル進捗は "1/5" 形式を基本に、
 * 収まらないときは割合 "60%" へフォールバックする。表示（setBadgeText）や
 * タイマー管理は background 側が担い、ここは文字列整形だけに徹する。
 */

/** バッジに収まる最大文字数。これを超える進捗表示は割合へフォールバックする。 */
export const BADGE_MAX_CHARS = 4;

/** キャプチャ失敗を示すバッジ文字列（赤背景で数秒表示する）。 */
export const ERROR_BADGE_TEXT = "!";

/**
 * 遅延キャプチャの残り秒数をカウントダウン表示する文字列にする。
 * - 端数は切り上げる（残り 2.3 秒なら "3"）。ユーザー体感の「あと n 秒」に合わせる。
 * - 0 以下・非有限は空文字（バッジ消去相当）。上限は BADGE_MAX_CHARS 桁で頭打ち。
 */
export function formatCountdownBadge(remainingSeconds: number): string {
	if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) return "";
	const secs = Math.ceil(remainingSeconds);
	const text = String(secs);
	// 想定外に大きな秒数（99999 秒等）でも 4 文字に収める。
	return text.length > BADGE_MAX_CHARS ? "9".repeat(BADGE_MAX_CHARS) : text;
}

/**
 * フルページキャプチャのタイル進捗を表示する文字列にする。
 * - 基本は "現在/総数"（例 "1/5"）。BADGE_MAX_CHARS に収まる場合はこれを使う。
 * - 収まらない場合（例 "12/20" は 5 文字）は割合 "60%" へフォールバックする。
 * - 総数 0 以下・非有限は空文字（進捗表示なし）。current は 0..total にクランプする。
 */
export function formatTileProgressBadge(
	current: number,
	total: number,
): string {
	if (!Number.isFinite(total) || total <= 0) return "";
	const t = Math.floor(total);
	const c = Math.min(Math.max(Math.floor(current), 0), t);
	const fraction = `${c}/${t}`;
	if (fraction.length <= BADGE_MAX_CHARS) return fraction;
	// "1/5" 形式が収まらないときは割合へ。四捨五入した整数パーセント + "%"。
	const percent = Math.round((c / t) * 100);
	return `${percent}%`;
}
