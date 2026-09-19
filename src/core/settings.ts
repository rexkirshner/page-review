import { DEFAULT_SETTINGS, type RetentionDays, type Settings } from "./model";

const RETENTION_OPTIONS: readonly RetentionDays[] = [7, 30, 90, null];

export function normalizeSettings(value: unknown): Settings {
  if (typeof value === "object" && value !== null && "retentionDays" in value) {
    const retentionDays = (value as { retentionDays?: unknown }).retentionDays;
    if (RETENTION_OPTIONS.includes(retentionDays as RetentionDays)) {
      return { retentionDays: retentionDays as RetentionDays };
    }
  }
  return { ...DEFAULT_SETTINGS };
}
