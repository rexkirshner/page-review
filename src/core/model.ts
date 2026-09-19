export const DRAFT_SCHEMA_VERSION = 1 as const;
export const EXPORT_FORMAT_VERSION = 1 as const;

export type RetentionDays = 7 | 30 | 90 | null;
export type TargetType = "page" | "text" | "element";
export type Resolution = "resolved" | "unresolved";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageContext {
  url: string;
  title: string;
  capturedAt: string;
  viewport: { width: number; height: number };
  scroll: Point;
  devicePixelRatio: number;
  userAgent: string;
}

export interface NodePath {
  indexes: number[];
}

export interface ElementSummary {
  tag: string;
  id?: string;
  classes: string[];
  attributes: Record<string, string>;
  text?: string;
  accessibleName?: string;
  cssPath: string;
}

export interface TextEvidence {
  kind: "text";
  exactQuote: string;
  range: {
    startContainer: NodePath;
    startOffset: number;
    endContainer: NodePath;
    endOffset: number;
  };
  containingElements: {
    start: ElementSummary;
    end: ElementSummary;
    common: ElementSummary;
  };
  before: string;
  after: string;
  sectionContext?: string;
  rects: Rect[];
}

export interface ElementEvidence extends ElementSummary {
  kind: "element";
  ancestors: ElementSummary[];
  rect: Rect;
}

export type TargetEvidence = TextEvidence | ElementEvidence;

export interface ScreenshotReference {
  filename: string;
  capturedAt: string;
  width: number;
  height: number;
}

export interface Annotation {
  id: string;
  type: TargetType;
  comment: string;
  createdAt: string;
  updatedAt: string;
  context: PageContext;
  target?: TargetEvidence;
  resolution: Resolution;
  screenshot?: ScreenshotReference;
}

export interface Draft {
  schemaVersion: typeof DRAFT_SCHEMA_VERSION;
  id: string;
  pageKey: string;
  createdAt: string;
  lastEditedAt: string;
  annotations: Annotation[];
}

export interface Settings {
  retentionDays: RetentionDays;
}

export const DEFAULT_SETTINGS: Settings = { retentionDays: 7 };

export interface FeedbackExport {
  formatVersion: typeof EXPORT_FORMAT_VERSION;
  exportedAt: string;
  page: {
    key: string;
    url: string;
    title: string;
  };
  annotations: Annotation[];
}
