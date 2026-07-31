import type { EditorApp } from "../app";
import { ArrowTool } from "./arrow";
import { CalloutTool } from "./callout";
import { EllipseTool } from "./ellipse";
import { MosaicTool } from "./mosaic";
import { RectTool } from "./rect";
import { SelectTool } from "./select";
import { StepTool } from "./step";
import { MarkerTool, PenTool } from "./stroke";
import { TextTool } from "./text";

/**
 * 全ツールを生成して app に登録する。
 * ツールを追加したらここに 1 行足すだけで配線される。
 */
export function registerTools(app: EditorApp): void {
	const ctx = app.context();
	app.registerTool(new SelectTool());
	app.registerTool(new ArrowTool(ctx));
	app.registerTool(new RectTool(ctx));
	app.registerTool(new EllipseTool(ctx));
	app.registerTool(new PenTool(ctx));
	app.registerTool(new MarkerTool(ctx));
	app.registerTool(new StepTool(ctx));
	app.registerTool(new CalloutTool(ctx));
	app.registerTool(new TextTool(ctx));
	app.registerTool(new MosaicTool(ctx));
}
