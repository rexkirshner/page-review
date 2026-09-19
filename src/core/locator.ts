export interface PathSegment {
  tag: string;
  id?: string;
  classes?: string[];
  nthOfType?: number;
}

export interface ElementFingerprint {
  tag: string;
  id?: string;
  classes: string[];
  attributes: Record<string, string>;
  text?: string;
  accessibleName?: string;
}

const GENERATED = /(^|[-_])(?:css|jsx|sc|emotion|chakra|mui)[-_]?|^[a-f\d]{8,}$|\d{5,}/i;

export function looksStable(value: string): boolean {
  return value.length > 0 && value.length <= 64 && !GENERATED.test(value);
}

export function cssEscape(value: string): string {
  if (value === "-") return "\\-";
  let escaped = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const code = value.charCodeAt(index);
    if (code === 0) {
      escaped += "\uFFFD";
    } else if ((code >= 1 && code <= 31) || code === 127
      || (index === 0 && code >= 48 && code <= 57)
      || (index === 1 && code >= 48 && code <= 57 && value[0] === "-")) {
      escaped += `\\${code.toString(16)} `;
    } else if (code >= 128 || character === "-" || character === "_"
      || (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      escaped += character;
    } else {
      escaped += `\\${character}`;
    }
  }
  return escaped;
}

export function buildCssPath(segments: PathSegment[]): string {
  const parts: string[] = [];
  for (const segment of segments) {
    if (segment.id && looksStable(segment.id)) {
      parts.push(`#${cssEscape(segment.id)}`);
      break;
    }
    const classes = (segment.classes ?? []).filter(looksStable).slice(0, 2);
    let part = segment.tag.toLowerCase() + classes.map((name) => `.${cssEscape(name)}`).join("");
    if (segment.nthOfType && segment.nthOfType > 1) part += `:nth-of-type(${segment.nthOfType})`;
    parts.push(part);
  }
  return parts.reverse().join(" > ");
}

export function scoreElementCandidate(expected: ElementFingerprint, candidate: ElementFingerprint): number {
  if (expected.tag.toLowerCase() !== candidate.tag.toLowerCase()) return 0;
  let score = 0.2;
  let possible = 0.2;

  if (expected.id) {
    possible += 0.35;
    if (expected.id === candidate.id) score += 0.35;
  }

  if (expected.classes.length) {
    possible += 0.15;
    const overlap = expected.classes.filter((name) => candidate.classes.includes(name)).length;
    score += 0.15 * (overlap / expected.classes.length);
  }

  const attributes = Object.entries(expected.attributes);
  if (attributes.length) {
    possible += 0.15;
    const matches = attributes.filter(([key, value]) => candidate.attributes[key] === value).length;
    score += 0.15 * (matches / attributes.length);
  }

  if (expected.accessibleName) {
    possible += 0.1;
    if (expected.accessibleName === candidate.accessibleName) score += 0.1;
  }

  if (expected.text) {
    possible += 0.05;
    if (expected.text === candidate.text) score += 0.05;
  }

  return score / possible;
}
