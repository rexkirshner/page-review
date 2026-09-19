import { DRAFT_SCHEMA_VERSION, type Draft } from "./model";

export type DraftReadResult =
  | { status: "ok"; draft: Draft; migrated: boolean }
  | { status: "missing" }
  | { status: "corrupt"; reason: string }
  | { status: "unsupported"; version: number };

interface LegacyDraftV0 {
  schemaVersion?: 0;
  id: string;
  pageKey: string;
  createdAt: string;
  updatedAt: string;
  annotations: unknown[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validV1(value: unknown): value is Draft {
  if (!isObject(value)) return false;
  return value.schemaVersion === DRAFT_SCHEMA_VERSION
    && typeof value.id === "string"
    && typeof value.pageKey === "string"
    && typeof value.createdAt === "string"
    && typeof value.lastEditedAt === "string"
    && Array.isArray(value.annotations)
    && value.annotations.every((annotation) => isObject(annotation)
      && typeof annotation.id === "string"
      && typeof annotation.comment === "string"
      && ["page", "text", "element"].includes(String(annotation.type)));
}

function migrateV0(value: LegacyDraftV0): Draft {
  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    id: value.id,
    pageKey: value.pageKey,
    createdAt: value.createdAt,
    lastEditedAt: value.updatedAt,
    annotations: value.annotations.map((annotation) => ({
      ...(annotation as Draft["annotations"][number]),
      resolution: (annotation as { resolution?: string }).resolution === "unresolved" ? "unresolved" : "resolved",
    })),
  };
}

export function readDraft(value: unknown): DraftReadResult {
  if (value === undefined || value === null) return { status: "missing" };
  if (!isObject(value)) return { status: "corrupt", reason: "Draft is not an object." };

  const version = value.schemaVersion ?? 0;
  if (typeof version !== "number") return { status: "corrupt", reason: "Draft schema version is invalid." };
  if (version > DRAFT_SCHEMA_VERSION) return { status: "unsupported", version };

  if (version === 0) {
    const legacy = value as unknown as LegacyDraftV0;
    if (typeof legacy.id !== "string" || typeof legacy.pageKey !== "string" ||
      typeof legacy.createdAt !== "string" || typeof legacy.updatedAt !== "string" ||
      !Array.isArray(legacy.annotations)) {
      return { status: "corrupt", reason: "Legacy draft is incomplete." };
    }
    const migrated = migrateV0(legacy);
    return validV1(migrated)
      ? { status: "ok", draft: migrated, migrated: true }
      : { status: "corrupt", reason: "Legacy draft annotations are invalid." };
  }

  return validV1(value)
    ? { status: "ok", draft: value, migrated: false }
    : { status: "corrupt", reason: "Draft fields are invalid." };
}
