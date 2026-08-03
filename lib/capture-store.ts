/** 1 件のキャプチャレコード。dataUrl はクロップ済みの PNG（表示範囲キャプチャなら表示領域全体）。 */
export interface CaptureRecord {
	id: string;
	dataUrl: string;
	width: number;
	height: number;
	capturedAt: number;
	sourceUrl: string;
	sourceTitle: string;
	/**
	 * 撮影時のビューポート（CSS px）。バグ報告テンプレートに使う。取れる経路
	 * （範囲選択・フルページ）でのみ記録し、既存の保存済みレコードとも後方互換
	 * （欠落＝未取得。URL・タイトルは既存の sourceUrl / sourceTitle を使う）。
	 */
	viewport?: { width: number; height: number };
}

const CAPTURE_PREFIX = "capture:";

function captureKey(id: string): string {
	return CAPTURE_PREFIX + id;
}

/** キャプチャを browser.storage.session に保存する。 */
export async function saveCapture(record: CaptureRecord): Promise<void> {
	await browser.storage.session.set({ [captureKey(record.id)]: record });
}

/** id からキャプチャを取得する。無ければ null。 */
export async function loadCapture(id: string): Promise<CaptureRecord | null> {
	const key = captureKey(id);
	const result = await browser.storage.session.get(key);
	return (result[key] as CaptureRecord | undefined) ?? null;
}
