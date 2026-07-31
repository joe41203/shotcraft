import { loadCapture } from "@/lib/capture-store";

const image = document.getElementById("image") as HTMLImageElement;
const empty = document.getElementById("empty") as HTMLParagraphElement;
const meta = document.getElementById("meta") as HTMLSpanElement;
const title = document.getElementById("title") as HTMLSpanElement;

function showEmpty(): void {
	image.hidden = true;
	empty.hidden = false;
}

async function main(): Promise<void> {
	const id = new URLSearchParams(location.search).get("id");
	if (!id) {
		showEmpty();
		return;
	}
	const record = await loadCapture(id);
	if (!record) {
		showEmpty();
		return;
	}
	meta.textContent = `${record.width} x ${record.height} px`;
	title.textContent = record.sourceTitle;
	image.src = record.dataUrl;
	image.hidden = false;
	empty.hidden = true;
}

void main();
