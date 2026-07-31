import Konva from "konva";
import { clampCropRect, cropBounds, cropRectEquals } from "@/lib/editor/crop";
import { type CropRect, setCrop } from "@/lib/editor/doc";
import { theme } from "@/lib/theme";
import type { EditorApp } from "./app";

/** 起動時プリセット矩形の内側インセット率（有効領域の短辺に対する割合）。 */
const INSET_RATIO = 0.08;

/**
 * クロップ操作の UI とライフサイクルを持つコントローラ。
 *
 * app が保持し、crop ツールの activate/deactivate から起動・終了する。
 * uiCrop レイヤーに「範囲外を暗くするシュラウド 4 枚 + 選択矩形 + Transformer」を
 * 画像座標系で描き、Enter で apply（doc.crop へ合成）/ Esc で cancel する。
 * 座標系はすべて元画像座標（レイヤーは app 側で crop オフセット済み）。
 */
export class CropController {
	private layer: Konva.Layer;
	private shrouds: Konva.Rect[] = [];
	private rect: Konva.Rect;
	private transformer: Konva.Transformer;
	/** 現在の有効領域（既存 crop または画像全体）。選択はこの中に収める。 */
	private bounds: CropRect = { x: 0, y: 0, width: 0, height: 0 };
	private active = false;

	constructor(private app: EditorApp) {
		this.layer = new Konva.Layer({ visible: false });

		for (let i = 0; i < 4; i++) {
			const shroud = new Konva.Rect({
				fill: "rgba(15, 23, 42, 0.6)",
				listening: false,
			});
			this.shrouds.push(shroud);
			this.layer.add(shroud);
		}

		this.rect = new Konva.Rect({
			draggable: true,
			stroke: theme.ring,
			strokeWidth: 1,
			// 透明でもヒット領域を持たせて内部ドラッグを拾う。
			fill: "rgba(0, 0, 0, 0.001)",
		});
		this.rect.on("dragmove transform", () => this.onRectChanged());
		this.rect.dragBoundFunc((pos) => this.constrainDrag(pos));
		this.layer.add(this.rect);

		this.transformer = new Konva.Transformer({
			rotateEnabled: false,
			flipEnabled: false,
			keepRatio: false,
			ignoreStroke: true,
			anchorSize: 10,
			borderStroke: theme.ring,
			anchorStroke: theme.ring,
			anchorFill: "#ffffff",
			boundBoxFunc: (oldBox, newBox) => this.constrainResize(oldBox, newBox),
		});
		this.layer.add(this.transformer);
	}

	/** クロップ用レイヤーをステージへ載せる（app 構築時に 1 回）。 */
	attach(stage: Konva.Stage): void {
		stage.add(this.layer);
	}

	/** クロップレイヤーのオフセットを本体レイヤーと揃える（crop 表示と同期）。 */
	setOffset(x: number, y: number): void {
		this.layer.position({ x, y });
	}

	isActive(): boolean {
		return this.active;
	}

	/** クロップモードを開始する。現在の有効領域内にプリセット矩形を出す。 */
	activate(): void {
		this.active = true;
		this.bounds = cropBounds(this.app.getCrop(), this.app.getContentSize());
		const inset = Math.round(
			Math.min(this.bounds.width, this.bounds.height) * INSET_RATIO,
		);
		this.rect.setAttrs({
			x: this.bounds.x + inset,
			y: this.bounds.y + inset,
			width: this.bounds.width - inset * 2,
			height: this.bounds.height - inset * 2,
			scaleX: 1,
			scaleY: 1,
		});
		this.transformer.nodes([this.rect]);
		this.layer.visible(true);
		this.updateShrouds();
		this.layer.moveToTop();
		this.layer.batchDraw();
	}

	/** クロップモードを終了して UI を片付ける。 */
	deactivate(): void {
		this.active = false;
		this.transformer.nodes([]);
		this.layer.visible(false);
		this.layer.batchDraw();
	}

	/** 選択矩形を doc.crop へ合成して適用する。実質変化が無ければ何もしない。 */
	apply(): void {
		const selection = this.currentSelection();
		const crop = clampCropRect(selection, this.bounds);
		this.app.setToolExternal("select");
		// 有効領域と一致（＝クロップ実質なし）なら履歴を汚さない。
		if (cropRectEquals(crop, this.bounds)) return;
		this.app.commitDoc(setCrop(this.app.getDoc(), crop));
		this.app.fitView();
	}

	/** クロップを中止して選択ツールへ戻る。 */
	cancel(): void {
		this.app.setToolExternal("select");
	}

	/** 選択矩形の現在の外形（元画像座標系、スケール焼き込み済み）。 */
	private currentSelection(): CropRect {
		return {
			x: this.rect.x(),
			y: this.rect.y(),
			width: this.rect.width() * this.rect.scaleX(),
			height: this.rect.height() * this.rect.scaleY(),
		};
	}

	/** ドラッグ位置を bounds 内に制限する（絶対座標系で計算）。 */
	private constrainDrag(pos: Konva.Vector2d): Konva.Vector2d {
		const scale = this.app.stage.scaleX();
		const layerPos = this.layer.getAbsolutePosition();
		// 絶対 → レイヤー相対（元画像座標）へ戻す。
		const local = {
			x: (pos.x - layerPos.x) / scale,
			y: (pos.y - layerPos.y) / scale,
		};
		const w = this.rect.width() * this.rect.scaleX();
		const h = this.rect.height() * this.rect.scaleY();
		const nx = clampNumber(
			local.x,
			this.bounds.x,
			this.bounds.x + this.bounds.width - w,
		);
		const ny = clampNumber(
			local.y,
			this.bounds.y,
			this.bounds.y + this.bounds.height - h,
		);
		return {
			x: layerPos.x + nx * scale,
			y: layerPos.y + ny * scale,
		};
	}

	/** リサイズ枠を bounds 内・最小サイズ以上に制限する（絶対座標系の box）。 */
	private constrainResize(oldBox: BoxLike, newBox: BoxLike): BoxLike {
		const scale = this.app.stage.scaleX();
		const layerPos = this.layer.getAbsolutePosition();
		const minPx = 10 * scale;
		if (newBox.width < minPx || newBox.height < minPx) return oldBox;

		const left = this.bounds.x * scale + layerPos.x;
		const top = this.bounds.y * scale + layerPos.y;
		const right = (this.bounds.x + this.bounds.width) * scale + layerPos.x;
		const bottom = (this.bounds.y + this.bounds.height) * scale + layerPos.y;
		if (
			newBox.x < left - 0.5 ||
			newBox.y < top - 0.5 ||
			newBox.x + newBox.width > right + 0.5 ||
			newBox.y + newBox.height > bottom + 0.5
		) {
			return oldBox;
		}
		return newBox;
	}

	private onRectChanged(): void {
		this.updateShrouds();
		this.layer.batchDraw();
	}

	/**
	 * 範囲外を暗くするシュラウドを、選択矩形を除いた上下左右の 4 帯で埋める。
	 * すべて bounds を基準にした元画像座標で計算する。
	 */
	private updateShrouds(): void {
		const sel = this.currentSelection();
		const b = this.bounds;
		const [top, bottom, left, right] = this.shrouds;
		// 上帯: bounds 上端〜選択上端
		top?.setAttrs({
			x: b.x,
			y: b.y,
			width: b.width,
			height: sel.y - b.y,
		});
		// 下帯: 選択下端〜bounds 下端
		bottom?.setAttrs({
			x: b.x,
			y: sel.y + sel.height,
			width: b.width,
			height: b.y + b.height - (sel.y + sel.height),
		});
		// 左帯: 選択の高さ範囲だけ、bounds 左端〜選択左端
		left?.setAttrs({
			x: b.x,
			y: sel.y,
			width: sel.x - b.x,
			height: sel.height,
		});
		// 右帯: 選択の高さ範囲だけ、選択右端〜bounds 右端
		right?.setAttrs({
			x: sel.x + sel.width,
			y: sel.y,
			width: b.x + b.width - (sel.x + sel.width),
			height: sel.height,
		});
	}
}

/** Konva の boundBoxFunc が扱う box 形状。 */
interface BoxLike {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

function clampNumber(v: number, min: number, max: number): number {
	return Math.min(Math.max(v, min), Math.max(min, max));
}
