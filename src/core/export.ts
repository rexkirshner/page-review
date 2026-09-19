import { strToU8, zipSync } from "fflate";
import { EXPORT_FORMAT_VERSION, type Annotation, type Draft, type FeedbackExport } from "./model";

export function toFeedbackExport(draft: Draft, exportedAt: string): FeedbackExport {
  const first = draft.annotations[0];
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt,
    page: {
      key: draft.pageKey,
      url: first?.context.url ?? draft.pageKey,
      title: first?.context.title ?? "Untitled page",
    },
    annotations: draft.annotations,
  };
}

function line(label: string, value: unknown): string {
  const plainString = typeof value === "string"
    && value.trim() === value
    && !/[\r\n\t]/.test(value);
  return `- ${label}: ${plainString ? value : JSON.stringify(value)}`;
}

function verbatimBlock(value: string): string {
  const longestRun = Math.max(0, ...(value.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}text\n${value}\n${fence}`;
}

function evidenceLines(annotation: Annotation): string[] {
  const target = annotation.target;
  if (!target) return [line("Target", "Page")];
  if (target.kind === "text") {
    return [
      line("Exact quote", target.exactQuote),
      line("Before", target.before),
      line("After", target.after),
      line("Section context", target.sectionContext ?? "None"),
      line("Range", target.range),
      line("Containing elements", target.containingElements),
      line("Bounding rects", target.rects),
    ];
  }
  return [
    line("Element", target.tag),
    line("ID", target.id ?? "None"),
    line("Stable classes", target.classes.length ? target.classes.join(" ") : "None"),
    line("Attributes", target.attributes),
    line("Visible text", target.text ?? "None"),
    line("Accessible name", target.accessibleName ?? "None"),
    line("CSS path", target.cssPath),
    line("Ancestors", target.ancestors),
    line("Bounding rect", target.rect),
  ];
}

export function exportMarkdown(draft: Draft, exportedAt: string): string {
  const packet = toFeedbackExport(draft, exportedAt);
  const output = [
    "# Feedback",
    "",
    line("Format version", packet.formatVersion),
    line("Exported at", packet.exportedAt),
    line("Page title", packet.page.title),
    line("Page URL", packet.page.url),
    line("Page key", packet.page.key),
  ];

  packet.annotations.forEach((annotation, index) => {
    output.push(
      "",
      `## ${index + 1}. ${annotation.type === "page" ? "Page comment" : `${annotation.type[0].toUpperCase()}${annotation.type.slice(1)} target`}`,
      "",
      verbatimBlock(annotation.comment),
      "",
      line("Annotation ID", annotation.id),
      line("Resolved", annotation.resolution === "resolved" ? "Yes" : "No"),
      line("Captured at", annotation.context.capturedAt),
      line("Created at", annotation.createdAt),
      line("Updated at", annotation.updatedAt),
      line("URL", annotation.context.url),
      line("Title", annotation.context.title),
      line("Viewport", annotation.context.viewport),
      line("Scroll", annotation.context.scroll),
      line("Device pixel ratio", annotation.context.devicePixelRatio),
      line("User agent", annotation.context.userAgent),
      ...evidenceLines(annotation),
      line("Screenshot", annotation.screenshot?.filename ?? "None"),
    );
  });

  return `${output.join("\n")}\n`;
}

export function exportJson(draft: Draft, exportedAt: string): string {
  return `${JSON.stringify(toFeedbackExport(draft, exportedAt), null, 2)}\n`;
}

export function buildZip(feedbackFilename: string, feedbackText: string, screenshots: Record<string, Uint8Array>): Uint8Array {
  const entries: Record<string, Uint8Array> = { [feedbackFilename]: strToU8(feedbackText) };
  for (const [filename, bytes] of Object.entries(screenshots)) entries[filename] = bytes;
  return zipSync(entries, { level: 6 });
}
