import { deleteDraftImages, deleteImage, getImage, putImage } from "./image-store";
import type { ExtensionRequest, ExtensionResponse } from "../shared/messages";

const ACTIVE_TAB_MESSAGE = "Keep the annotated tab active while its screenshot is captured.";
const DEFAULT_ACTION_TITLE = "Toggle feedback mode";
const DEFAULT_BADGE_TEXT = "+";
const DEFAULT_BADGE_COLOR = "#f05a35";

async function clearActionError(tabId: number): Promise<void> {
  await Promise.all([
    chrome.action.setBadgeBackgroundColor({ tabId, color: DEFAULT_BADGE_COLOR }),
    chrome.action.setBadgeText({ tabId, text: DEFAULT_BADGE_TEXT }),
    chrome.action.setTitle({ tabId, title: DEFAULT_ACTION_TITLE }),
  ]);
}

async function initializeAction(): Promise<void> {
  await Promise.all([
    chrome.action.setBadgeBackgroundColor({ color: DEFAULT_BADGE_COLOR }),
    chrome.action.setBadgeText({ text: DEFAULT_BADGE_TEXT }),
    chrome.action.setTitle({ title: DEFAULT_ACTION_TITLE }),
  ]);
}

async function showActionError(tabId: number): Promise<void> {
  await Promise.all([
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#9a311f" }),
    chrome.action.setBadgeText({ tabId, text: "!" }),
    chrome.action.setTitle({ tabId, title: "Feedback Packet cannot run on this page." }),
  ]);
}

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

chrome.runtime.onInstalled.addListener(() => { void initializeAction(); });
chrome.runtime.onStartup.addListener(() => { void initializeAction(); });
void initializeAction();

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await clearActionError(tab.id);
  } catch (error) {
    try { await showActionError(tab.id); }
    catch (actionError) { console.warn("Feedback Packet could not update its action state.", actionError); }
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
        default:
          return { ok: false, error: "Unsupported extension request." };
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unknown extension error." };
    }
  };

  void respond().then(sendResponse);
  return true;
});
