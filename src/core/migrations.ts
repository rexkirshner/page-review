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

function isNonNegativeInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value) && value >= 0;
}

function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isRect(value: unknown): boolean {
  return isObject(value) && isNumber(value.x) && isNumber(value.y)
    && isNumber(value.width) && value.width >= 0
    && isNumber(value.height) && value.height >= 0;
}

function isElementSummary(value: unknown): boolean {
  return isObject(value) && typeof value.tag === "string" && typeof value.cssPath === "string"
    && isOptionalString(value.id) && isOptionalString(value.text) && isOptionalString(value.accessibleName)
    && Array.isArray(value.classes) && value.classes.every((item) => typeof item === "string")
    && isObject(value.attributes) && Object.values(value.attributes).every((item) => typeof item === "string");
}

function isContext(value: unknown): boolean {
  return isObject(value) && typeof value.url === "string" && typeof value.title === "string"
    && isTimestamp(value.capturedAt) && isObject(value.viewport)
    && isPositiveNumber(value.viewport.width) && isPositiveNumber(value.viewport.height) && isObject(value.scroll)
    && isNumber(value.scroll.x) && isNumber(value.scroll.y) && isPositiveNumber(value.devicePixelRatio)
    && typeof value.userAgent === "string";
}

function isTarget(value: unknown): boolean {
  if (!isObject(value) || (value.kind !== "text" && value.kind !== "element")) return false;
  if (value.kind === "element") {
    return isElementSummary(value) && Array.isArray(value.ancestors)
      && value.ancestors.every(isElementSummary) && isRect(value.rect);
  }
  return typeof value.exactQuote === "string" && value.exactQuote.trim().length > 0
    && typeof value.before === "string" && typeof value.after === "string"
    && isOptionalString(value.sectionContext)
    && isObject(value.range) && isObject(value.range.startContainer) && Array.isArray(value.range.startContainer.indexes)
    && value.range.startContainer.indexes.every(isNonNegativeInteger) && isNonNegativeInteger(value.range.startOffset)
    && isObject(value.range.endContainer) && Array.isArray(value.range.endContainer.indexes)
    && value.range.endContainer.indexes.every(isNonNegativeInteger) && isNonNegativeInteger(value.range.endOffset)
    && isObject(value.containingElements) && isElementSummary(value.containingElements.start)
    && isElementSummary(value.containingElements.end) && isElementSummary(value.containingElements.common)
    && Array.isArray(value.rects) && value.rects.every(isRect);
}

function isAnnotation(value: unknown): boolean {
  if (!isObject(value)) return false;
  const type = String(value.type);
  return typeof value.id === "string" && value.id.length > 0 && typeof value.comment === "string"
    && ["page", "text", "element"].includes(type)
    && isTimestamp(value.createdAt) && isTimestamp(value.updatedAt)
    && (value.resolution === "resolved" || value.resolution === "unresolved")
    && isContext(value.context)
    && (type === "page"
      ? value.target === undefined
      : isObject(value.target) && value.target.kind === type && isTarget(value.target))
    && (value.screenshot === undefined || (isObject(value.screenshot)
      && value.screenshot.filename === `${value.id}.png` && isTimestamp(value.screenshot.capturedAt)
      && isPositiveNumber(value.screenshot.width) && isPositiveNumber(value.screenshot.height)));
}

function hasUniqueAnnotationIds(annotations: unknown[]): boolean {
  const ids = annotations.map((annotation) => isObject(annotation) ? annotation.id : undefined);
  return new Set(ids).size === ids.length;
}

function validV1(value: unknown): value is Draft {
  if (!isObject(value)) return false;
  return value.schemaVersion === DRAFT_SCHEMA_VERSION
    && typeof value.id === "string" && value.id.length > 0
    && typeof value.pageKey === "string" && value.pageKey.length > 0
    && isTimestamp(value.createdAt)
    && isTimestamp(value.lastEditedAt)
    && Array.isArray(value.annotations)
    && value.annotations.every(isAnnotation)
    && hasUniqueAnnotationIds(value.annotations);
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
