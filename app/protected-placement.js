const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function normalizedRegion(region) {
  if (!region) return null;
  const left = clamp(region.x, 0, 1);
  const top = clamp(region.y, 0, 1);
  const right = clamp(region.x + region.width, left, 1);
  const bottom = clamp(region.y + region.height, top, 1);
  return { left, top, right, bottom };
}

function boundsFor(region, foreground, imageWidth, imageHeight) {
  if (!region) return null;
  const scale = foreground.width / imageWidth;
  return {
    left: foreground.x + region.left * imageWidth * scale,
    top: foreground.y + region.top * imageHeight * scale,
    right: foreground.x + region.right * imageWidth * scale,
    bottom: foreground.y + region.bottom * imageHeight * scale,
  };
}

function fitPlan({ mode, region, targetWidth, targetHeight, imageWidth, imageHeight }) {
  const insetRatio = mode === "extend" ? .06 : 0;
  const insetX = targetWidth * insetRatio;
  const insetY = targetHeight * insetRatio;
  const availableWidth = targetWidth - insetX * 2;
  const availableHeight = targetHeight - insetY * 2;
  let scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);

  if (region) {
    const focusX = (region.left + region.right) / 2 * imageWidth;
    const focusY = (region.top + region.bottom) / 2 * imageHeight;
    const horizontalSpace = targetWidth / 2 - insetX;
    const verticalSpace = targetHeight / 2 - insetY;
    const focusLimits = [
      horizontalSpace / Math.max(1, focusX),
      horizontalSpace / Math.max(1, imageWidth - focusX),
      verticalSpace / Math.max(1, focusY),
      verticalSpace / Math.max(1, imageHeight - focusY),
    ];
    scale = Math.min(scale, ...focusLimits);
  }

  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const focusX = region ? (region.left + region.right) / 2 * imageWidth : imageWidth / 2;
  const focusY = region ? (region.top + region.bottom) / 2 * imageHeight : imageHeight / 2;
  const foreground = {
    x: targetWidth / 2 - focusX * scale,
    y: targetHeight / 2 - focusY * scale,
    width,
    height,
  };

  return {
    mode,
    foreground,
    background: mode === "extend" ? { type: "mirror" } : null,
    protectedBounds: boundsFor(region, foreground, imageWidth, imageHeight),
    fallback: null,
    canFullyProtect: true,
    verticalTravel: { up: 0, down: 0, total: 0 },
  };
}

function cropRange({ region, targetWidth, targetHeight, imageWidth, imageHeight, insetRatio }) {
  const scale = Math.max(targetWidth / imageWidth, targetHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const insetX = targetWidth * insetRatio;
  const insetY = targetHeight * insetRatio;
  const regionLeft = region.left * imageWidth * scale;
  const regionTop = region.top * imageHeight * scale;
  const regionRight = region.right * imageWidth * scale;
  const regionBottom = region.bottom * imageHeight * scale;
  const minimumX = Math.max(targetWidth - width, insetX - regionLeft);
  const maximumX = Math.min(0, targetWidth - insetX - regionRight);
  const minimumY = Math.max(targetHeight - height, insetY - regionTop);
  const maximumY = Math.min(0, targetHeight - insetY - regionBottom);
  return { scale, width, height, insetX, insetY, regionLeft, regionTop, regionRight, regionBottom, minimumX, maximumX, minimumY, maximumY, feasible: minimumX <= maximumX && minimumY <= maximumY };
}

/**
 * Produces one render plan used by both the result preview and PNG export.
 * @param {{
 *   mode: "preserve" | "extend" | "crop",
 *   region?: { x: number, y: number, width: number, height: number } | null,
 *   targetWidth: number,
 *   targetHeight: number,
 *   imageWidth: number,
 *   imageHeight: number,
 *   verticalOffset?: number,
 * }} input
 */
export function computePlacement({ mode, region: rawRegion, targetWidth, targetHeight, imageWidth, imageHeight, verticalOffset = 0 }) {
  const region = normalizedRegion(rawRegion);
  if (mode !== "crop") return fitPlan({ mode, region, targetWidth, targetHeight, imageWidth, imageHeight });

  if (!region) {
    const scale = Math.max(targetWidth / imageWidth, targetHeight / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    const x = (targetWidth - width) / 2;
    const minimumY = targetHeight - height;
    const maximumY = 0;
    const baseY = (minimumY + maximumY) / 2;
    const offset = clamp(verticalOffset, -1, 1);
    const y = offset < 0 ? baseY + (-offset) * (minimumY - baseY) : baseY + offset * (maximumY - baseY);
    return { mode, foreground: { x, y, width, height }, background: null, protectedBounds: null, fallback: null, canFullyProtect: true, verticalTravel: { up: baseY - minimumY, down: maximumY - baseY, total: maximumY - minimumY } };
  }

  let range = cropRange({ region, targetWidth, targetHeight, imageWidth, imageHeight, insetRatio: .04 });
  if (!range.feasible) range = cropRange({ region, targetWidth, targetHeight, imageWidth, imageHeight, insetRatio: 0 });

  if (!range.feasible) {
    const fallback = fitPlan({ mode: "extend", region, targetWidth, targetHeight, imageWidth, imageHeight });
    return { ...fallback, mode, fallback: "extend", canFullyProtect: true };
  }

  const focusX = (range.regionLeft + range.regionRight) / 2;
  const focusY = (range.regionTop + range.regionBottom) / 2;
  const baseX = clamp(targetWidth / 2 - focusX, range.minimumX, range.maximumX);
  const baseY = clamp(targetHeight / 2 - focusY, range.minimumY, range.maximumY);
  const offset = clamp(verticalOffset, -1, 1);
  const y = offset < 0
    ? baseY + (-offset) * (range.minimumY - baseY)
    : baseY + offset * (range.maximumY - baseY);
  const foreground = { x: baseX, y, width: range.width, height: range.height };
  return {
    mode,
    foreground,
    background: null,
    protectedBounds: boundsFor(region, foreground, imageWidth, imageHeight),
    fallback: null,
    canFullyProtect: true,
    verticalTravel: { up: baseY - range.minimumY, down: range.maximumY - baseY, total: range.maximumY - range.minimumY },
  };
}
