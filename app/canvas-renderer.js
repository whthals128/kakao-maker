/**
 * Returns mirrored edge-band tiles around the preserved foreground rectangle.
 * Only the outer source bands are repeated, so a centered product is not duplicated.
 *
 * @param {{ x: number, y: number, width: number, height: number }} foreground
 * @param {number} targetWidth
 * @param {number} targetHeight
 * @param {number} imageWidth
 * @param {number} imageHeight
 */
export function computeEdgeExtensionTiles(foreground, targetWidth, targetHeight, imageWidth, imageHeight) {
  const sourceBandWidth = Math.max(1, imageWidth * .18);
  const sourceBandHeight = Math.max(1, imageHeight * .18);
  const bandWidth = Math.max(.01, foreground.width * .18);
  const bandHeight = Math.max(.01, foreground.height * .18);
  const leftCount = Math.ceil(Math.max(0, foreground.x) / bandWidth);
  const rightCount = Math.ceil(Math.max(0, targetWidth - foreground.x - foreground.width) / bandWidth);
  const topCount = Math.ceil(Math.max(0, foreground.y) / bandHeight);
  const bottomCount = Math.ceil(Math.max(0, targetHeight - foreground.y - foreground.height) / bandHeight);
  const tiles = [];

  const addTile = (kind, x, y, width, height, sourceX, sourceY, sourceWidth, sourceHeight, flipX, flipY) => {
    tiles.push({ kind, x, y, width, height, sourceX, sourceY, sourceWidth, sourceHeight, flipX, flipY });
  };

  for (let index = 0; index < leftCount; index += 1) {
    addTile("left", foreground.x - (index + 1) * bandWidth, foreground.y, bandWidth, foreground.height, 0, 0, sourceBandWidth, imageHeight, index % 2 === 0, false);
  }
  for (let index = 0; index < rightCount; index += 1) {
    addTile("right", foreground.x + foreground.width + index * bandWidth, foreground.y, bandWidth, foreground.height, imageWidth - sourceBandWidth, 0, sourceBandWidth, imageHeight, index % 2 === 0, false);
  }
  for (let index = 0; index < topCount; index += 1) {
    addTile("top", foreground.x, foreground.y - (index + 1) * bandHeight, foreground.width, bandHeight, 0, 0, imageWidth, sourceBandHeight, false, index % 2 === 0);
  }
  for (let index = 0; index < bottomCount; index += 1) {
    addTile("bottom", foreground.x, foreground.y + foreground.height + index * bandHeight, foreground.width, bandHeight, 0, imageHeight - sourceBandHeight, imageWidth, sourceBandHeight, false, index % 2 === 0);
  }

  for (const horizontal of [
    { side: "left", count: leftCount, sourceX: 0, x: (index) => foreground.x - (index + 1) * bandWidth },
    { side: "right", count: rightCount, sourceX: imageWidth - sourceBandWidth, x: (index) => foreground.x + foreground.width + index * bandWidth },
  ]) {
    for (const vertical of [
      { side: "top", count: topCount, sourceY: 0, y: (index) => foreground.y - (index + 1) * bandHeight },
      { side: "bottom", count: bottomCount, sourceY: imageHeight - sourceBandHeight, y: (index) => foreground.y + foreground.height + index * bandHeight },
    ]) {
      for (let column = 0; column < horizontal.count; column += 1) {
        for (let row = 0; row < vertical.count; row += 1) {
          addTile(`${vertical.side}-${horizontal.side}`, horizontal.x(column), vertical.y(row), bandWidth, bandHeight, horizontal.sourceX, vertical.sourceY, sourceBandWidth, sourceBandHeight, column % 2 === 0, row % 2 === 0);
        }
      }
    }
  }
  return tiles;
}

function drawTile(ctx, image, tile) {
  ctx.save();
  ctx.translate(tile.x + (tile.flipX ? tile.width : 0), tile.y + (tile.flipY ? tile.height : 0));
  ctx.scale(tile.flipX ? -1 : 1, tile.flipY ? -1 : 1);
  ctx.drawImage(image, tile.sourceX, tile.sourceY, tile.sourceWidth, tile.sourceHeight, 0, 0, tile.width, tile.height);
  ctx.restore();
}

/**
 * Draws the exact same render plan for on-page previews and full-resolution PNGs.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} image
 * @param {number} targetWidth
 * @param {number} targetHeight
 * @param {{ foreground: { x: number, y: number, width: number, height: number }, background: { type: string } | null }} plan
 */
export function renderPlanToContext(ctx, image, targetWidth, targetHeight, plan) {
  ctx.save();
  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.fillStyle = "#eceef2";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (plan.background?.type === "mirror") {
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, targetWidth, targetHeight);
    ctx.clip();
    for (const tile of computeEdgeExtensionTiles(plan.foreground, targetWidth, targetHeight, imageWidth, imageHeight)) {
      drawTile(ctx, image, tile);
    }
    ctx.restore();
  }

  const foreground = plan.foreground;
  ctx.drawImage(image, foreground.x, foreground.y, foreground.width, foreground.height);
  ctx.restore();
}
