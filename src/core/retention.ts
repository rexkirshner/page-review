import type { Draft, RetentionDays } from "./model";

const DAY_MS = 86_400_000;

export function expiresAt(lastEditedAt: string, retentionDays: RetentionDays): number | null {
  if (retentionDays === null) return null;
  return Date.parse(lastEditedAt) + retentionDays * DAY_MS;
}

export function isExpired(draft: Pick<Draft, "lastEditedAt">, retentionDays: RetentionDays, now: number): boolean {
  const expiry = expiresAt(draft.lastEditedAt, retentionDays);
  return expiry !== null && Number.isFinite(expiry) && now >= expiry;
}
