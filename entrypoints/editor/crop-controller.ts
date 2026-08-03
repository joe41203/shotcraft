import Konva from "konva";
import {
	type CropRatio,
	clampCropRect,
	constrainResizeToRatio,
	cropBounds,
	cropRatioValue,
	cropRectEquals,
	fitRectToRatio,
} from "@/lib/editor/crop";
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
	/** 現在のアスペクト比拘束（自由 / 1:1 / 4:3 / 16:9）。app.style.cropRatio と同期する。 */
	private ratio: CropRatio = "free";
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
		this.ratio = this.app.getCropRatio();
		this.bounds = cropBounds(this.app.getCrop(), this.app.getContentSize());
		const inset = Math.round(
			Math.min(this.bounds.width, this.bounds.height) * INSET_RATIO,
		);
		// プリセット矩形（インセット枠）を現在の比率に整形してから配置する。
		const preset = fitRectToRatio(
			{
				x: this.bounds.x + inset,
				y: this.bounds.y + inset,
				width: this.bounds.width - inset * 2,
				height: this.bounds.height - inset * 2,
			},
			cropRatioValue(this.ratio),
			this.bounds,
		);
		this.rect.setAttrs({
			x: preset.x,
			y: preset.y,
			width: preset.width,
			height: preset.height,
			scaleX: 1,
			scaleY: 1,
		});
		this.transformer.nodes([this.rect]);
		this.layer.visible(true);
		this.updateShrouds();
		this.layer.moveToTop();
		this.layer.batchDraw();
	}

	/**
	 * アスペクト比拘束を切り替える。クロップ操作中なら、既存の選択枠を中心を保って
	 * その比率へ整形して張り直す（自由なら整形せずクランプのみ）。クロップ操作中で
	 * ないときは次回 activate 時に反映されるので何もしない。
	 */
	setRatio(ratio: CropRatio): void {
		this.ratio = ratio;
		if (!this.active) return;
		const current = this.currentSelection();
		const next = fitRectToRatio(current, cropRatioValue(ratio), this.bounds);
		this.rect.setAttrs({
			x: next.x,
			y: next.y,
			width: next.width,
			height: next.height,
			scaleX: 1,
			scaleY: 1,
		});
		this.updateShrouds();
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

	/**
	 * リサイズ枠を、比率拘束（あれば）→ bounds 内 → 最小サイズの順に制限する
	 * （boundBoxFunc の box は絶対座標系）。比率拘束は元画像座標系で計算するため、
	 * まず絶対 box を画像座標へ戻して constrainResizeToRatio を掛け、その結果を
	 * 絶対座標へ戻してから bounds 判定する。比率を保った結果が bounds をはみ出す
	 * ときは oldBox を返して据え置く（自由リサイズと同じく「範囲外は動かさない」）。
	 */
	private constrainResize(oldBox: BoxLike, newBox: BoxLike): BoxLike {
		const scale = this.app.stage.scaleX();
		const layerPos = this.layer.getAbsolutePosition();
		const minPx = 10 * scale;

		// 比率拘束を元画像座標系で適用する（自由なら newBox のまま）。
		const ratio = cropRatioValue(this.ratio);
		let box = newBox;
		if (ratio != null) {
			const oldImg = this.absBoxToImage(oldBox, scale, layerPos);
			const newImg = this.absBoxToImage(newBox, scale, layerPos);
			const fitted = constrainResizeToRatio(oldImg, newImg, ratio);
			box = this.imageRectToAbsBox(fitted, scale, layerPos, newBox.rotation);
		}

		if (box.width < minPx || box.height < minPx) return oldBox;

		const left = this.bounds.x * scale + layerPos.x;
		const top = this.bounds.y * scale + layerPos.y;
		const right = (this.bounds.x + this.bounds.width) * scale + layerPos.x;
		const bottom = (this.bounds.y + this.bounds.height) * scale + layerPos.y;
		if (
			box.x < left - 0.5 ||
			box.y < top - 0.5 ||
			box.x + box.width > right + 0.5 ||
			box.y + box.height > bottom + 0.5
		) {
			return oldBox;
		}
		return box;
	}

	/** 絶対座標系の box を元画像座標系の矩形へ戻す（レイヤーオフセット・スケールを外す）。 */
	private absBoxToImage(
		box: BoxLike,
		scale: number,
		layerPos: Konva.Vector2d,
	): CropRect {
		return {
			x: (box.x - layerPos.x) / scale,
			y: (box.y - layerPos.y) / scale,
			width: box.width / scale,
			height: box.height / scale,
		};
	}

	/** 元画像座標系の矩形を絶対座標系の box へ変換する（スケール・レイヤーオフセットを掛ける）。 */
	private imageRectToAbsBox(
		rect: CropRect,
		scale: number,
		layerPos: Konva.Vector2d,
		rotation: number,
	): BoxLike {
		return {
			x: rect.x * scale + layerPos.x,
			y: rect.y * scale + layerPos.y,
			width: rect.width * scale,
			height: rect.height * scale,
			rotation,
		};
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
