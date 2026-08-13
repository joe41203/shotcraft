/**
 * EyeDropper API の型定義。
 *
 * 画面上の任意の 1 点の色を拾うブラウザ API（Chrome 95〜）。TypeScript の標準
 * ライブラリ（lib.dom.d.ts）にまだ含まれていないため、使う分だけをここで宣言する。
 * 追加の権限は要らず、拡張のタブから呼ぶと他ウィンドウ・画面上の色も拾える。
 *
 * 仕様: https://wicg.github.io/eyedropper-api/
 */

interface ColorSelectionResult {
	/** 選んだ色（`#rrggbb` 形式の小文字 16 進）。 */
	sRGBHex: string;
}

interface ColorSelectionOptions {
	/** 選択を中断するためのシグナル（Esc でのキャンセルは自動）。 */
	signal?: AbortSignal;
}

declare class EyeDropper {
	constructor();
	/**
	 * スポイトを起動して 1 点の色を選ばせる。ユーザーが Esc 等で中断すると
	 * AbortError で reject する（＝キャンセルは例外として届く。正常系として扱う）。
	 */
	open(options?: ColorSelectionOptions): Promise<ColorSelectionResult>;
}

interface Window {
	/** 非対応環境では undefined（存在確認してから使う）。 */
	EyeDropper?: typeof EyeDropper;
}
