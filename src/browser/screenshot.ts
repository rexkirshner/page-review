import type { Rect } from "../core/model";
import { projectRectToBitmap } from "../core/screenshot-geometry";
import type { ExtensionRequest, ExtensionResponse } from "../shared/messages";

async function send(request: ExtensionRequest): Promise<ExtensionResponse> {
  const response: unknown = await chrome.runtime.sendMessage(request);
  if (typeof response !== "object" || response === null || !("ok" in response)
    || typeof (response as { ok?: unknown }).ok !== "boolean") {
    throw new Error("The extension did not return a valid response. Refresh this page and try again.");
  }
  return response as ExtensionResponse;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Chrome returned an unreadable screenshot."));
    image.src = dataUrl;
  });
}

export async function markScreenshot(dataUrl: string, targetRects: Rect[], viewport: { width: number; height: number }): Promise<{ dataUrl: string; width: number; height: number }> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(image, 0, 0);

  const scaleX = image.naturalWidth / viewport.width;
  const scaleY = image.naturalHeight / viewport.height;
  context.lineWidth = Math.max(4, 3 * Math.max(scaleX, scaleY));
  context.strokeStyle = "#ff4d24";
  context.fillStyle = "rgba(255, 77, 36, 0.12)";
  for (const target of targetRects) {
    const projected = projectRectToBitmap(
      target,
      viewport,
      { width: image.naturalWidth, height: image.naturalHeight },
    );
    if (!projected) continue;
    context.fillRect(projected.x, projected.y, projected.width, projected.height);
    context.strokeRect(projected.x, projected.y, projected.width, projected.height);
  }
  return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}

export async function captureVisibleScreenshot(targetRects: Rect[], hide: () => void, show: () => void): Promise<{ dataUrl: string; width: number; height: number; capturedAt: string }> {
  hide();
  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const response = await send({ type: "capture-visible" });
    if (!response.ok || !response.dataUrl) throw new Error(response.ok ? "Chrome returned no screenshot." : response.error);
    const marked = await markScreenshot(response.dataUrl, targetRects, { width: window.innerWidth, height: window.innerHeight });
    return { ...marked, capturedAt: new Date().toISOString() };
  } finally {
    show();
  }
}

export async function putScreenshot(key: string, dataUrl: string): Promise<void> {
  const response = await send({ type: "image-put", key, dataUrl });
  if (!response.ok) throw new Error(response.error);
}

export async function getScreenshot(key: string): Promise<string | undefined> {
  const response = await send({ type: "image-get", key });
  if (!response.ok) throw new Error(response.error);
  return response.dataUrl;
}

export async function deleteScreenshot(key: string): Promise<void> {
  const response = await send({ type: "image-delete", key });
  if (!response.ok) throw new Error(response.error);
}

export async function deleteDraftScreenshots(draftId: string): Promise<void> {
  const response = await send({ type: "images-delete-draft", draftId });
  if (!response.ok) throw new Error(response.error);
}
