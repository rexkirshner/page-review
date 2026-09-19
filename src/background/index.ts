import { deleteDraftImages, deleteImage, getImage, putImage } from "./image-store";
import type { ExtensionRequest, ExtensionResponse } from "../shared/messages";

const ACTIVE_TAB_MESSAGE = "Keep the annotated tab active while its screenshot is captured.";

async function captureSenderTab(sender: chrome.runtime.MessageSender): Promise<string> {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (tabId === undefined || windowId === undefined) throw new Error("The annotated tab is unavailable.");

  const before = await chrome.tabs.get(tabId);
  if (!before.active || before.windowId !== windowId) throw new Error(ACTIVE_TAB_MESSAGE);
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
  const after = await chrome.tabs.get(tabId);
  if (!after.active || after.windowId !== windowId) throw new Error(ACTIVE_TAB_MESSAGE);
  return dataUrl;
}

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
          return { ok: true, dataUrl: await captureSenderTab(sender) };
        }
        case "image-put":
          await putImage(request.key, request.dataUrl);
          return { ok: true };
        case "image-get": {
          const dataUrl = await getImage(request.key);
          return dataUrl === undefined ? { ok: true } : { ok: true, dataUrl };
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
