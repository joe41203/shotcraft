import type { EditorDoc } from "./doc";

const DOC_PREFIX = "doc:";

function docKey(captureId: string): string {
	return DOC_PREFIX + captureId;
}

/** 編集中ドキュメントを browser.storage.session に保存する。 */
export async function saveDoc(
	captureId: string,
	doc: EditorDoc,
): Promise<void> {
	await browser.storage.session.set({ [docKey(captureId)]: doc });
}

/** captureId の編集ドキュメントを取得する。無ければ null。 */
export async function loadDoc(captureId: string): Promise<EditorDoc | null> {
	const key = docKey(captureId);
	const result = await browser.storage.session.get(key);
	return (result[key] as EditorDoc | undefined) ?? null;
}

/**
 * doc の保存を debounce するオートセーバを作る。
 * commit のたびに schedule() を呼ぶと、最後の呼び出しから delayMs 後に 1 回だけ保存する。
 * これによりドラッグ連打などで保存が過剰に走るのを防ぐ。
 */
export function createDocAutosaver(
	captureId: string,
	delayMs = 300,
): { schedule(doc: EditorDoc): void; flush(): Promise<void> } {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let pending: EditorDoc | null = null;

	const persist = async (): Promise<void> => {
		if (!pending) return;
		const doc = pending;
		pending = null;
		await saveDoc(captureId, doc);
	};

	return {
		schedule(doc: EditorDoc): void {
			pending = doc;
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				timer = null;
				void persist();
			}, delayMs);
		},
		async flush(): Promise<void> {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			await persist();
		},
	};
}
