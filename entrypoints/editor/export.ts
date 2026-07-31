import Konva from "konva";
import { croppedSize } from "@/lib/editor/crop";
import type { EditorDoc } from "@/lib/editor/doc";
import { type MosaicSource, renderShapes } from "./render";

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

/** canvas を PNG Blob へ変換する Promise。ClipboardItem に Promise のまま渡せる。 */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error("PNG への変換に失敗しました"));
		}, "image/png");
	});
}

/** `shotcraft-YYYYMMDD-HHmmss.png` 形式のファイル名を作る（ローカル時刻）。 */
export function exportFilename(now: Date = new Date()): string {
	const p2 = (n: number): string => String(n).padStart(2, "0");
	const stamp =
		`${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}` +
		`-${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;
	return `shotcraft-${stamp}.png`;
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
