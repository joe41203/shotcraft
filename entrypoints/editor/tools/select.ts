import type { Tool, ToolName } from "./types";

/**
 * 選択ツール。
 * クリック選択・移動・リサイズ・回転・削除の実処理は app 側に集約している
 * （図形ノードのクリック→select、Transformer による変形→dragend/transformend で
 * doc へ焼き込み、Delete/Backspace で削除、Esc で選択解除）。
 * このツールは「選択モードである」ことを表す識別子として存在する。
 */
export class SelectTool implements Tool {
	readonly name: ToolName = "select";
}
