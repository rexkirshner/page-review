import { DRAFT_SCHEMA_VERSION, type Draft } from "./model";

export type DraftReadResult =
  | { status: "ok"; draft: Draft; migrated: boolean }
  | { status: "missing" }
  | { status: "corrupt"; reason: string; draftId?: string }
  | { status: "unsupported"; version: number; draftId?: string };

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

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRect(value: unknown): boolean {
  return isObject(value) && isNumber(value.x) && isNumber(value.y) && isNumber(value.width) && isNumber(value.height);
}

function isElementSummary(value: unknown): boolean {
  return isObject(value) && typeof value.tag === "string" && typeof value.cssPath === "string"
    && Array.isArray(value.classes) && value.classes.every((item) => typeof item === "string")
    && isObject(value.attributes) && Object.values(value.attributes).every((item) => typeof item === "string");
}

function isContext(value: unknown): boolean {
  return isObject(value) && typeof value.url === "string" && typeof value.title === "string"
    && typeof value.capturedAt === "string" && isObject(value.viewport)
    && isNumber(value.viewport.width) && isNumber(value.viewport.height) && isObject(value.scroll)
    && isNumber(value.scroll.x) && isNumber(value.scroll.y) && isNumber(value.devicePixelRatio)
    && typeof value.userAgent === "string";
}

function isTarget(value: unknown): boolean {
  if (!isObject(value) || (value.kind !== "text" && value.kind !== "element")) return false;
  if (value.kind === "element") {
    return isElementSummary(value) && Array.isArray(value.ancestors)
      && value.ancestors.every(isElementSummary) && isRect(value.rect);
  }
  return typeof value.exactQuote === "string" && typeof value.before === "string" && typeof value.after === "string"
    && isObject(value.range) && isObject(value.range.startContainer) && Array.isArray(value.range.startContainer.indexes)
    && value.range.startContainer.indexes.every(isNumber) && isNumber(value.range.startOffset)
    && isObject(value.range.endContainer) && Array.isArray(value.range.endContainer.indexes)
    && value.range.endContainer.indexes.every(isNumber) && isNumber(value.range.endOffset)
    && isObject(value.containingElements) && isElementSummary(value.containingElements.start)
    && isElementSummary(value.containingElements.end) && isElementSummary(value.containingElements.common)
    && Array.isArray(value.rects) && value.rects.every(isRect);
}

function isAnnotation(value: unknown): boolean {
  if (!isObject(value)) return false;
  const type = String(value.type);
  return typeof value.id === "string" && typeof value.comment === "string"
    && ["page", "text", "element"].includes(type)
    && typeof value.createdAt === "string" && typeof value.updatedAt === "string"
    && (value.resolution === "resolved" || value.resolution === "unresolved")
    && isContext(value.context)
    && (type === "page" ? value.target === undefined : isTarget(value.target))
    && (value.screenshot === undefined || (isObject(value.screenshot)
      && typeof value.screenshot.filename === "string" && typeof value.screenshot.capturedAt === "string"
      && isNumber(value.screenshot.width) && isNumber(value.screenshot.height)));
}

function validV1(value: unknown): value is Draft {
  if (!isObject(value)) return false;
  return value.schemaVersion === DRAFT_SCHEMA_VERSION
    && typeof value.id === "string"
    && typeof value.pageKey === "string"
    && typeof value.createdAt === "string"
    && typeof value.lastEditedAt === "string"
    && Array.isArray(value.annotations)
    && value.annotations.every(isAnnotation);
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
  const draftId = typeof value.id === "string" ? value.id : undefined;

  const version = value.schemaVersion ?? 0;
  if (typeof version !== "number") return { status: "corrupt", reason: "Draft schema version is invalid.", draftId };
  if (version > DRAFT_SCHEMA_VERSION) return { status: "unsupported", version, draftId };

  if (version === 0) {
    const legacy = value as unknown as LegacyDraftV0;
    if (typeof legacy.id !== "string" || typeof legacy.pageKey !== "string" ||
      typeof legacy.createdAt !== "string" || typeof legacy.updatedAt !== "string" ||
      !Array.isArray(legacy.annotations)) {
      return { status: "corrupt", reason: "Legacy draft is incomplete.", draftId };
    }
    const migrated = migrateV0(legacy);
    return validV1(migrated)
      ? { status: "ok", draft: migrated, migrated: true }
      : { status: "corrupt", reason: "Legacy draft annotations are invalid.", draftId };
  }

  return validV1(value)
    ? { status: "ok", draft: value, migrated: false }
    : { status: "corrupt", reason: "Draft fields are invalid.", draftId };
}
