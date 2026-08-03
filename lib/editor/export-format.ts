/**
 * 書き出し形式（PNG / JPEG / WebP）と品質（高 / 標準 / 低）の型・正規化・定数の純粋計算。
 *
 * Konva・DOM に依存しない純粋ロジックだけをここに集める（ユニットテスト対象）。
 * 実際の canvas → Blob 変換やファイル名生成など DOM に触れる処理は
 * entrypoints/editor/export.ts が持ち、この型・正規化・定数を利用する。
 * style-prefs.ts（記憶）もここを参照して保存値を正規化する。
 */

/** 書き出し形式（PNG / JPEG / WebP）。省略・不正値は "png"（既定）。 */
export type ExportFormat = "png" | "jpeg" | "webp";

/** JPEG / WebP の圧縮品質（高 / 標準 / 低）。PNG では無視される（可逆圧縮のため）。 */
export type ExportQuality = "high" | "normal" | "low";

/** 書き出し形式の既定（省略時）。 */
export const DEFAULT_EXPORT_FORMAT: ExportFormat = "png";

/** 書き出し品質の既定（省略時）。 */
export const DEFAULT_EXPORT_QUALITY: ExportQuality = "normal";

/** 品質プリセット → toBlob へ渡す 0〜1 の品質値（高 0.92 / 標準 0.85 / 低 0.7）。 */
export const EXPORT_QUALITY_VALUES: Record<ExportQuality, number> = {
	high: 0.92,
	normal: 0.85,
	low: 0.7,
};

/** 形式 → MIME タイプ・拡張子・短いラベル（ボタン表示・ファイル名に使う）。 */
export const EXPORT_FORMAT_INFO: Record<
	ExportFormat,
	{ mime: string; ext: string; label: string }
> = {
	png: { mime: "image/png", ext: "png", label: "PNG" },
	jpeg: { mime: "image/jpeg", ext: "jpg", label: "JPEG" },
	webp: { mime: "image/webp", ext: "webp", label: "WebP" },
};

/** 任意の値を ExportFormat へ正規化する純粋関数。3 値以外（未設定・不正値）は "png"。 */
export function normalizeExportFormat(raw: unknown): ExportFormat {
	if (raw === "png" || raw === "jpeg" || raw === "webp") return raw;
	return DEFAULT_EXPORT_FORMAT;
}

/** 任意の値を ExportQuality へ正規化する純粋関数。3 値以外（未設定・不正値）は "normal"。 */
export function normalizeExportQuality(raw: unknown): ExportQuality {
	if (raw === "high" || raw === "normal" || raw === "low") return raw;
	return DEFAULT_EXPORT_QUALITY;
}
