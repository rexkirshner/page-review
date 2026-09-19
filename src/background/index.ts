import { deleteDraftImages, deleteImage, getImage, putImage } from "./image-store";
import type { ExtensionRequest, ExtensionResponse } from "../shared/messages";

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (error) {
    console.warn("Feedback Packet cannot run on this page.", error);
  }
});

chrome.runtime.onMessage.addListener((request: ExtensionRequest, sender, sendResponse) => {
  const respond = async (): Promise<ExtensionResponse> => {
    try {
      switch (request.type) {
        case "capture-visible": {
          if (sender.tab?.windowId === undefined) throw new Error("The active tab is unavailable.");
          const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" });
          return { ok: true, dataUrl };
        }
        case "image-put":
          await putImage(request.key, request.dataUrl);
          return { ok: true };
        case "image-get": {
          const dataUrl = await getImage(request.key);
          return { ok: true, dataUrl };
        }
        case "image-delete":
          await deleteImage(request.key);
          return { ok: true };
        case "images-delete-draft":
          await deleteDraftImages(request.draftId);
          return { ok: true };
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unknown extension error." };
    }
  };

  void respond().then(sendResponse);
  return true;
});
