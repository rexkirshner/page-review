import { buildCssPath, looksStable, scoreElementCandidate, type ElementFingerprint, type PathSegment } from "../core/locator";
import type { ElementEvidence, ElementSummary, NodePath, PageContext, Rect, TextEvidence } from "../core/model";

const CONTEXT_LENGTH = 100;

function cleanText(value: string | null | undefined, max = 240): string | undefined {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function rect(value: DOMRect): Rect {
  return { x: value.x, y: value.y, width: value.width, height: value.height };
}

function nthOfType(element: Element): number {
  let index = 1;
  let sibling = element.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === element.tagName) index += 1;
    sibling = sibling.previousElementSibling;
  }
  return index;
}

function pathSegments(element: Element): PathSegment[] {
  const segments: PathSegment[] = [];
  let current: Element | null = element;
  while (current && current !== document.documentElement) {
    segments.push({
      tag: current.tagName.toLowerCase(),
      id: current.id || undefined,
      classes: Array.from(current.classList),
      nthOfType: nthOfType(current),
    });
    if (current.id && looksStable(current.id)) break;
    current = current.parentElement;
  }
  if (current === document.documentElement) segments.push({ tag: "html" });
  return segments;
}

function evidenceAttributes(element: Element): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const attribute of element.attributes) {
    if (!(attribute.name.startsWith("data-") || attribute.name.startsWith("aria-"))) continue;
    if (!attribute.value || attribute.value.length > 160) continue;
    attributes[attribute.name] = attribute.value;
  }
  return attributes;
}

function accessibleName(element: Element): string | undefined {
  const labelledBy = element.getAttribute("aria-labelledby");
  const labelledText = labelledBy
    ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ")
    : undefined;
  return cleanText(
    element.getAttribute("aria-label")
      ?? labelledText
      ?? element.getAttribute("alt")
      ?? element.getAttribute("title"),
  );
}

export function summarizeElement(element: Element): ElementSummary {
  return {
    tag: element.tagName.toLowerCase(),
    id: element.id && looksStable(element.id) ? element.id : undefined,
    classes: Array.from(element.classList).filter(looksStable).slice(0, 8),
    attributes: evidenceAttributes(element),
    text: cleanText(element.textContent),
    accessibleName: accessibleName(element),
    cssPath: buildCssPath(pathSegments(element)),
  };
}

function fingerprint(element: Element): ElementFingerprint {
  const summary = summarizeElement(element);
  return {
    tag: summary.tag,
    id: summary.id,
    classes: summary.classes,
    attributes: summary.attributes,
    text: summary.text,
    accessibleName: summary.accessibleName,
  };
}

export function nodePath(node: Node): NodePath {
  const indexes: number[] = [];
  let current: Node | null = node;
  while (current && current !== document.documentElement) {
    const parentNode: Node | null = current.parentNode;
    if (!parentNode) break;
    indexes.push(Array.prototype.indexOf.call(parentNode.childNodes, current));
    current = parentNode;
  }
  return { indexes: indexes.reverse() };
}

function nodeFromPath(path: NodePath): Node | undefined {
  let current: Node = document.documentElement;
  for (const index of path.indexes) {
    const next: ChildNode | undefined = current.childNodes[index];
    if (!next) return undefined;
    current = next;
  }
  return current;
}

function elementForNode(node: Node): Element {
  return node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement ?? document.body;
}

function commonElement(range: Range): Element {
  return elementForNode(range.commonAncestorContainer);
}

function surroundingText(range: Range): { before: string; after: string } {
  const root = commonElement(range);
  const all = root.textContent ?? "";
  const prefix = document.createRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.startContainer, range.startOffset);
  const start = prefix.toString().length;
  const selected = range.toString().length;
  return {
    before: all.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    after: all.slice(start + selected, start + selected + CONTEXT_LENGTH),
  };
}

function sectionContext(element: Element): string | undefined {
  const section = element.closest("section, article, main, aside, nav") ?? element.parentElement;
  const heading = section?.querySelector("h1, h2, h3, h4, h5, h6")
    ?? Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).reverse().find((item) =>
      item.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING);
  return cleanText(heading?.textContent, 160);
}

export function capturePageContext(capturedAt = new Date().toISOString()): PageContext {
  return {
    url: location.href,
    title: document.title,
    capturedAt,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scroll: { x: window.scrollX, y: window.scrollY },
    devicePixelRatio: window.devicePixelRatio,
    userAgent: navigator.userAgent,
  };
}

export function captureTextEvidence(selection: Selection): { evidence: TextEvidence; range: Range } | undefined {
  if (selection.rangeCount !== 1 || selection.isCollapsed) return undefined;
  const range = selection.getRangeAt(0).cloneRange();
  const exactQuote = range.toString();
  if (!exactQuote.trim()) return undefined;
  const startElement = elementForNode(range.startContainer);
  const endElement = elementForNode(range.endContainer);
  const common = commonElement(range);
  const surrounding = surroundingText(range);
  return {
    range,
    evidence: {
      kind: "text",
      exactQuote,
      range: {
        startContainer: nodePath(range.startContainer),
        startOffset: range.startOffset,
        endContainer: nodePath(range.endContainer),
        endOffset: range.endOffset,
      },
      containingElements: {
        start: summarizeElement(startElement),
        end: summarizeElement(endElement),
        common: summarizeElement(common),
      },
      before: surrounding.before,
      after: surrounding.after,
      sectionContext: sectionContext(common),
      rects: Array.from(range.getClientRects()).map(rect),
    },
  };
}

export function captureElementEvidence(element: Element): ElementEvidence {
  const summary = summarizeElement(element);
  const ancestors: ElementSummary[] = [];
  let current = element.parentElement;
  while (current && ancestors.length < 5) {
    const item = summarizeElement(current);
    if (item.id || item.classes.length || Object.keys(item.attributes).length || /^(main|section|article|nav|aside)$/.test(item.tag)) {
      ancestors.push(item);
    }
    current = current.parentElement;
  }
  return { kind: "element", ...summary, ancestors, rect: rect(element.getBoundingClientRect()) };
}

function hasElementSignals(evidence: ElementEvidence): boolean {
  return Boolean(evidence.id || evidence.classes.length || Object.keys(evidence.attributes).length || evidence.text || evidence.accessibleName || evidence.ancestors.length);
}

export function locateElement(evidence: ElementEvidence): Element | undefined {
  let exact: Element | null = null;
  try { exact = document.querySelector(evidence.cssPath); } catch { /* Invalid paths are unresolved. */ }
  if (exact && hasElementSignals(evidence) && scoreElementCandidate(evidence, fingerprint(exact)) >= 0.78) return exact;

  const candidates = Array.from(document.getElementsByTagName(evidence.tag)).slice(0, 1000)
    .map((element) => ({ element, score: scoreElementCandidate(evidence, fingerprint(element)) }))
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const second = candidates[1];
  if (!best || !hasElementSignals(evidence) || best.score < 0.86 || (second && best.score - second.score < 0.08)) return undefined;
  return best.element;
}

function rangeFromPaths(evidence: TextEvidence): Range | undefined {
  const start = nodeFromPath(evidence.range.startContainer);
  const end = nodeFromPath(evidence.range.endContainer);
  if (!start || !end) return undefined;
  try {
    const range = document.createRange();
    range.setStart(start, evidence.range.startOffset);
    range.setEnd(end, evidence.range.endOffset);
    return range.toString() === evidence.exactQuote ? range : undefined;
  } catch {
    return undefined;
  }
}

function textNodes(): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      return parent && !parent.closest("script, style, noscript") && node.textContent
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

export function locateText(evidence: TextEvidence): Range | undefined {
  const direct = rangeFromPaths(evidence);
  if (direct) return direct;

  const nodes = textNodes();
  const starts: number[] = [];
  let text = "";
  for (const node of nodes) { starts.push(text.length); text += node.data; }
  const matches: number[] = [];
  let position = text.indexOf(evidence.exactQuote);
  while (position >= 0) { matches.push(position); position = text.indexOf(evidence.exactQuote, position + 1); }
  const contextual = matches.filter((start) => {
    const before = text.slice(Math.max(0, start - evidence.before.length), start);
    const after = text.slice(start + evidence.exactQuote.length, start + evidence.exactQuote.length + evidence.after.length);
    return (!evidence.before || before === evidence.before) && (!evidence.after || after === evidence.after);
  });
  const chosen = contextual.length === 1 ? contextual[0] : matches.length === 1 ? matches[0] : undefined;
  if (chosen === undefined) return undefined;

  const endPosition = chosen + evidence.exactQuote.length;
  let startIndex = -1;
  let endIndex = -1;
  for (let index = 0; index < starts.length; index += 1) {
    if (starts[index] <= chosen) startIndex = index;
    if (starts[index] < endPosition) endIndex = index;
  }
  if (startIndex < 0 || endIndex < 0) return undefined;
  const range = document.createRange();
  range.setStart(nodes[startIndex], chosen - starts[startIndex]);
  range.setEnd(nodes[endIndex], endPosition - starts[endIndex]);
  return range.toString() === evidence.exactQuote ? range : undefined;
}
