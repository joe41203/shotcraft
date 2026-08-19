#!/usr/bin/env bash
# renders/video.mp4 → docs/images/demo.gif
#
# README にインライン埋め込みして自動ループさせるための GIF を作る。
# 暗い地に少数の色という素材なので、パレット生成を効かせると小さく・きれいに収まる。
#
# 使い方: ./make-gif.sh [出力幅(px)] [fps]
set -euo pipefail

cd "$(dirname "$0")"

SRC="renders/video.mp4"
OUT="../../docs/images/demo.gif"
WIDTH="${1:-960}"   # README 上の実表示幅に合わせる。大きくしてもファイルが太るだけ
FPS="${2:-16}"      # 12〜18 が体感と容量の折り合い点

[ -f "$SRC" ] || { echo "先に render を実行してください: $SRC がありません" >&2; exit 1; }

PALETTE="$(mktemp -t shotcraft-palette).png"
trap 'rm -f "$PALETTE"' EXIT

# 1 パス目: この動画専用の 256 色パレットを作る（暗部の階調を優先）
ffmpeg -y -loglevel error -i "$SRC" \
  -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,palettegen=stats_mode=diff" \
  "$PALETTE"

# 2 パス目: パレットを当てて GIF 化。bayer ディザは平坦な暗部の帯を抑えつつ粒状感が軽い
ffmpeg -y -loglevel error -i "$SRC" -i "$PALETTE" \
  -lavfi "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
  -loop 0 "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "✓ $OUT (${WIDTH}px / ${FPS}fps / ${SIZE})"
echo "  10MB を超えるようなら幅か fps を下げてください: ./make-gif.sh 800 14"
