import { type CaptureRecord, loadCapture } from "@/lib/capture-store";
import { EditorApp } from "./app";

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

	const imageEl = await loadImage(record.dataUrl);
	new EditorApp(stageContainer, toolbarRoot, record, imageEl);
}

void main();
