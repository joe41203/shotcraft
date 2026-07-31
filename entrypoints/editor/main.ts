import { type CaptureRecord, loadCapture } from "@/lib/capture-store";
import { createDocAutosaver, loadDoc } from "@/lib/editor/doc-store";
import { EditorApp } from "./app";
import { registerTools } from "./tools";

const stageContainer = document.getElementById("stage") as HTMLDivElement;
const toolbarRoot = document.getElementById("toolbar") as HTMLElement;
const empty = document.getElementById("empty") as HTMLParagraphElement;
const meta = document.getElementById("meta") as HTMLSpanElement;
const title = document.getElementById("title") as HTMLSpanElement;

function showEmpty(): void {
	stageContainer.hidden = true;
	toolbarRoot.hidden = true;
	empty.hidden = false;
}

/** dataUrl を Konva.Image で使える HTMLImageElement として読み込む。 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
		img.src = dataUrl;
	});
}

/**
 * 同梱フォント（はちまるポップ / よもぎ / キウイ丸）の読み込み完了を待つ。
 * Konva は canvas にテキストを描くため、読み込み前に描画するとフォールバック
 * フォントで描かれてしまう。エディタ初期化前にここで確実にロードしておく。
 * ネットワークではなく同梱ファイルなので通常は即座に解決するが、失敗しても
 * フォールバックで描画は続けられるよう握りつぶす（描画を止めない）。
 */
async function ensureFontsLoaded(): Promise<void> {
	try {
		await Promise.all([
			document.fonts.load("400 16px 'Hachi Maru Pop'"),
			document.fonts.load("400 16px 'Yomogi'"),
			document.fonts.load("400 16px 'Kiwi Maru'"),
			document.fonts.load("500 16px 'Kiwi Maru'"),
		]);
	} catch {
		// フォント読み込み失敗時はフォールバックで描画する。
	}
}

async function main(): Promise<void> {
	const id = new URLSearchParams(location.search).get("id");
	if (!id) {
		showEmpty();
		return;
	}
	const record: CaptureRecord | null = await loadCapture(id);
	if (!record) {
		showEmpty();
		return;
	}

	meta.textContent = `${record.width} x ${record.height} px`;
	title.textContent = record.sourceTitle;
	document.title = `shotcraft - ${record.sourceTitle || "編集"}`;

	// 前回の編集内容があれば復元し、履歴の初期状態にする。
	const savedDoc = await loadDoc(id);

	// 画像・保存済み注釈にテキストが含まれると初期描画で Konva.Text が走るため、
	// 同梱フォントの読み込みを画像ロードと並行して待ってから EditorApp を生成する。
	const [imageEl] = await Promise.all([
		loadImage(record.dataUrl),
		ensureFontsLoaded(),
	]);
	const app = new EditorApp(
		stageContainer,
		toolbarRoot,
		record,
		imageEl,
		savedDoc ?? undefined,
	);
	registerTools(app);

	// 編集内容を debounce して storage.session に自動保存する。
	const autosaver = createDocAutosaver(id, 300);
	app.onDocCommitted = (doc) => autosaver.schedule(doc);
	// リロード/離脱の直前に未保存分を書き出す。
	window.addEventListener("pagehide", () => void autosaver.flush());
}

void main();
