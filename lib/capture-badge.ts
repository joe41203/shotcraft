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
