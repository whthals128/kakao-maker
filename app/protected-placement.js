/**
 * Places an image so the complete user-selected region stays inside the output.
 * A target-relative safety inset is reserved on every side of the region.
 *
 * @param {{
 *   region: { x: number, y: number, width: number, height: number },
 *   targetWidth: number,
 *   targetHeight: number,
 *   imageWidth: number,
 *   imageHeight: number,
 *   safetyInset?: number,
 * }} input
 */
export function computeProtectedPlacement({
  region,
  targetWidth,
  targetHeight,
  imageWidth,
  imageHeight,
  safetyInset = .04,
}) {
  const left = Math.max(0, Math.min(1, region.x));
  const top = Math.max(0, Math.min(1, region.y));
  const right = Math.max(left, Math.min(1, region.x + region.width));
  const bottom = Math.max(top, Math.min(1, region.y + region.height));
  const regionWidth = Math.max(1, (right - left) * imageWidth);
  const regionHeight = Math.max(1, (bottom - top) * imageHeight);
  const insetX = Math.min(targetWidth * safetyInset, targetWidth * .2);
  const insetY = Math.min(targetHeight * safetyInset, targetHeight * .2);
  const availableWidth = Math.max(1, targetWidth - insetX * 2);
  const availableHeight = Math.max(1, targetHeight - insetY * 2);

  const coverScale = Math.max(targetWidth / imageWidth, targetHeight / imageHeight);
  const protectedScale = Math.min(availableWidth / regionWidth, availableHeight / regionHeight);
  const scale = Math.min(coverScale, protectedScale);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const regionLeft = left * imageWidth * scale;
  const regionTop = top * imageHeight * scale;
  const regionRight = right * imageWidth * scale;
  const regionBottom = bottom * imageHeight * scale;

  const desiredX = targetWidth / 2 - (regionLeft + regionRight) / 2;
  const desiredY = targetHeight / 2 - (regionTop + regionBottom) / 2;
  const minimumX = insetX - regionLeft;
  const maximumX = targetWidth - insetX - regionRight;
  const minimumY = insetY - regionTop;
  const maximumY = targetHeight - insetY - regionBottom;
  const x = Math.max(minimumX, Math.min(maximumX, desiredX));
  const y = Math.max(minimumY, Math.min(maximumY, desiredY));

  return {
    x,
    y,
    width,
    height,
    scale,
    insetX,
    insetY,
    protectedBounds: {
      left: x + regionLeft,
      top: y + regionTop,
      right: x + regionRight,
      bottom: y + regionBottom,
    },
  };
}
