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

	const imageEl = await loadImage(record.dataUrl);
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
