import type { EditorApp } from "../app";
import { ArrowTool } from "./arrow";
import { EllipseTool } from "./ellipse";
import { RectTool } from "./rect";
import { MarkerTool, PenTool } from "./stroke";
import { TextTool } from "./text";

/**
 * 全ツールを生成して app に登録する。
 * ツールを追加したらここに 1 行足すだけで配線される。
 */
export function registerTools(app: EditorApp): void {
	const ctx = app.context();
	app.registerTool(new ArrowTool(ctx));
	app.registerTool(new RectTool(ctx));
	app.registerTool(new EllipseTool(ctx));
	app.registerTool(new PenTool(ctx));
	app.registerTool(new MarkerTool(ctx));
	app.registerTool(new TextTool(ctx));
}
