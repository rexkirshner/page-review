import type { Rect } from "./model";

interface Size {
  width: number;
  height: number;
}

export function projectRectToBitmap(target: Rect, viewport: Size, bitmap: Size): Rect | undefined {
  if (viewport.width <= 0 || viewport.height <= 0 || bitmap.width <= 0 || bitmap.height <= 0) return undefined;

  const left = Math.max(0, target.x);
  const top = Math.max(0, target.y);
  const right = Math.min(viewport.width, target.x + target.width);
  const bottom = Math.min(viewport.height, target.y + target.height);
  if (right <= left || bottom <= top) return undefined;

  const scaleX = bitmap.width / viewport.width;
  const scaleY = bitmap.height / viewport.height;
  return {
    x: left * scaleX,
    y: top * scaleY,
    width: (right - left) * scaleX,
    height: (bottom - top) * scaleY,
  };
}
