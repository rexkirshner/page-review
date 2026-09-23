export const TRACKING_PARAMS = Object.freeze(["utm_*", "fbclid", "gclid"]);

export function pageKey(input: string): string {
  const url = new URL(input);
  const kept: Array<[string, string]> = [];

  for (const [key, value] of url.searchParams) {
    const lower = key.toLowerCase();
    const tracking = TRACKING_PARAMS.some((pattern) => pattern.endsWith("*")
      ? lower.startsWith(pattern.slice(0, -1))
      : lower === pattern);
    if (tracking) continue;
    kept.push([key, value]);
  }

  url.search = "";
  for (const [key, value] of kept) url.searchParams.append(key, value);

  return `${url.origin}${url.pathname}${url.search}${url.hash}`;
}
