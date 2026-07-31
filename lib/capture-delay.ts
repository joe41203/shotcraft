/**
 * 遅延キャプチャの待機時間（ms）に関する定数と正規化。
 * popup が選ぶタイマー値と background の待機処理で同じ規則を共有する。
 */

/** popup のタイマー選択肢（ラベルと待機 ms）。「なし」は 0＝即時。 */
export const CAPTURE_DELAY_OPTIONS = [
	{ value: 0, label: "即時" },
	{ value: 3000, label: "3秒" },
	{ value: 5000, label: "5秒" },
] as const;

/** 待機時間の上限（ms）。想定外に長い遅延で待ち続けるのを防ぐ。 */
export const MAX_CAPTURE_DELAY_MS = 60_000;

/**
 * 遅延キャプチャの待機 ms を安全な範囲へ正規化する純粋関数。
 * - undefined / NaN / 非有限 / 0 以下 → 0（即時。後方互換）。
 * - 上限超過 → MAX_CAPTURE_DELAY_MS。
 * - それ以外 → 端数を切り捨てた整数 ms。
 */
export function clampCaptureDelayMs(delayMs: number | undefined): number {
	if (delayMs == null || !Number.isFinite(delayMs) || delayMs <= 0) return 0;
	return Math.min(Math.floor(delayMs), MAX_CAPTURE_DELAY_MS);
}
