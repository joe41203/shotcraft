import Konva from "konva";
import { croppedSize } from "@/lib/editor/crop";
import type { EditorDoc } from "@/lib/editor/doc";
import {
	EXPORT_FORMAT_INFO,
	EXPORT_QUALITY_VALUES,
	type ExportFormat,
	type ExportQuality,
} from "@/lib/editor/export-format";
import { type MosaicSource, renderShapes } from "./render";

// 形式・品質の型と正規化は純粋計算（lib/editor/export-format.ts）が正。利用側が
// export.ts からも取れるよう再エクスポートする（従来 export.ts を import していた
// 呼び出し・テストの互換のため）。
export {
	EXPORT_QUALITY_VALUES,
	type ExportFormat,
	type ExportQuality,
	normalizeExportFormat,
	normalizeExportQuality,
} from "@/lib/editor/export-format";

/** エクスポートに必要な入力。表示 Stage とは独立にここから作り直す。 */
export interface ExportInput {
	doc: EditorDoc;
	/** ベース画像（キャプチャ原寸。モザイクのサンプリング元にもなる）。 */
	image: MosaicSource;
	/** キャプチャ原寸（画像全体の寸法）。 */
	imageSize: { width: number; height: number };
}

/**
 * doc から出力用の Konva Stage を組み立てて原寸の canvas を得る。
 *
 * 表示用 Stage とは別に、画面外コンテナへ新しい Stage を都度生成する。
 * これにより表示ズーム・パン・選択枠・Transformer の影響を一切受けず、
 * 常に「ベース画像 + モザイク + 注釈、クロップ適用後、キャプチャ原寸」で描ける。
 * crop はレイヤーのオフセット＋Stage 寸法（＝クロップ寸法）で表現する。
 * 呼び出し後は Stage と一時コンテナを destroy して後始末する。
 */
export function exportToCanvas(input: ExportInput): HTMLCanvasElement {
	const { doc, image, imageSize } = input;
	const size = croppedSize(doc.crop, imageSize);
	const offset = { x: -(doc.crop?.x ?? 0), y: -(doc.crop?.y ?? 0) };

	// 画面に出さない一時コンテナ（Konva.Stage は DOM コンテナを要求する）。
	const container = document.createElement("div");
	container.style.position = "fixed";
	container.style.left = "-100000px";
	container.style.top = "0";
	document.body.appendChild(container);

	const stage = new Konva.Stage({
		container,
		width: size.width,
		height: size.height,
	});
	try {
		const bgLayer = new Konva.Layer({ listening: false });
		bgLayer.add(
			new Konva.Image({
				image,
				x: 0,
				y: 0,
				width: imageSize.width,
				height: imageSize.height,
			}),
		);
		bgLayer.position(offset);

		const shapeLayer = new Konva.Layer({ listening: false });
		// 出力なのでドラッグ不可。モザイクのサンプリング元に image を渡す。
		renderShapes(shapeLayer, doc, false, image);
		shapeLayer.position(offset);

		stage.add(bgLayer, shapeLayer);
		stage.draw();

		// pixelRatio=1 で表示ズームに依らずキャプチャ原寸の 1:1 canvas を得る。
		return stage.toCanvas({ pixelRatio: 1 });
	} finally {
		stage.destroy();
		container.remove();
	}
}

/**
 * JPEG は透過を持てないので、透過キャンバスをそのまま書き出すと透明部分が黒く潰れる。
 * 白背景の上に元 canvas を重ねた不透明 canvas を作ってから書き出す（透過安全策）。
 * PNG / WebP は透過を保持できるのでそのまま返す。
 */
function flattenForOpaque(canvas: HTMLCanvasElement): HTMLCanvasElement {
	const out = document.createElement("canvas");
	out.width = canvas.width;
	out.height = canvas.height;
	const ctx = out.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, out.width, out.height);
		ctx.drawImage(canvas, 0, 0);
	}
	return out;
}

/**
 * canvas を指定形式の Blob へ変換する Promise。ClipboardItem に Promise のまま渡せる。
 * - PNG は可逆圧縮なので quality は無視される。
 * - JPEG / WebP は quality（EXPORT_QUALITY_VALUES の 0〜1）で圧縮率を決める。
 * - JPEG は透過を持てないため、書き出し前に白背景で合成する（透過部分の黒潰れ防止）。
 */
export function canvasToBlob(
	canvas: HTMLCanvasElement,
	format: ExportFormat = "png",
	quality: ExportQuality = "normal",
): Promise<Blob> {
	const info = EXPORT_FORMAT_INFO[format];
	// JPEG のみ白背景合成（透過安全策）。PNG / WebP は透過を保持したまま書き出す。
	const source = format === "jpeg" ? flattenForOpaque(canvas) : canvas;
	const q = EXPORT_QUALITY_VALUES[quality];
	return new Promise((resolve, reject) => {
		source.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error(`${info.mime} への変換に失敗しました`));
			},
			info.mime,
			// PNG では第 3 引数は無視される。JPEG / WebP でのみ効く。
			format === "png" ? undefined : q,
		);
	});
}

/**
 * canvas を PNG Blob へ変換する Promise。クリップボードコピーは互換性のため常に PNG を
 * 使うので、その用途で呼ばれる（canvasToBlob(canvas, "png") へ委譲する薄いラッパ）。
 */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return canvasToBlob(canvas, "png");
}

/**
 * `shotcraft-YYYYMMDD-HHmmss.<ext>` 形式のファイル名を作る（ローカル時刻）。
 * 拡張子は形式に対応（png / jpg / webp）。既定は PNG（従来互換）。
 */
export function exportFilename(
	now: Date = new Date(),
	format: ExportFormat = "png",
): string {
	const p2 = (n: number): string => String(n).padStart(2, "0");
	const stamp =
		`${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}` +
		`-${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;
	return `shotcraft-${stamp}.${EXPORT_FORMAT_INFO[format].ext}`;
}

/**
 * Blob を `<a download>` でダウンロードする（downloads 権限不要）。
 * object URL は一定時間後に解放する。
 */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
