import { readDraft, type DraftReadResult } from "../core/migrations";
import { DEFAULT_SETTINGS, DRAFT_SCHEMA_VERSION, type Draft, type Settings } from "../core/model";
import { isExpired } from "../core/retention";
import { deleteDraftScreenshots } from "./screenshot";

const SETTINGS_KEY = "settings";
const draftKey = (key: string) => `draft:${key}`;

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const value = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
  return [7, 30, 90, null].includes(value?.retentionDays ?? 7)
    ? { retentionDays: value?.retentionDays ?? 7 }
    : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function loadDraft(key: string, settings: Settings, now = Date.now()): Promise<DraftReadResult & { expired?: boolean }> {
  const storageKey = draftKey(key);
  const stored = await chrome.storage.local.get(storageKey);
  const result = readDraft(stored[storageKey]);
  if (result.status !== "ok") return result;
  if (isExpired(result.draft, settings.retentionDays, now)) {
    await chrome.storage.local.remove(storageKey);
    await deleteDraftScreenshots(result.draft.id);
    return { status: "missing", expired: true };
  }
  if (result.migrated) await saveDraft(result.draft);
  return result;
}

export async function saveDraft(draft: Draft): Promise<void> {
  await chrome.storage.local.set({ [draftKey(draft.pageKey)]: draft });
}

export async function clearDraft(draft: Draft): Promise<void> {
  await chrome.storage.local.remove(draftKey(draft.pageKey));
  await deleteDraftScreenshots(draft.id);
}

export async function clearStoredDraft(key: string, storedDraftId?: string): Promise<void> {
  await chrome.storage.local.remove(draftKey(key));
  if (storedDraftId) await deleteDraftScreenshots(storedDraftId);
}

export function createDraft(key: string, now = new Date().toISOString()): Draft {
  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    pageKey: key,
    createdAt: now,
    lastEditedAt: now,
    annotations: [],
  };
}
