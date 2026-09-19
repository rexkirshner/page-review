const INVALIDATED_CONTEXT = /extension context invalidated/i;

export function userFacingError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (INVALIDATED_CONTEXT.test(message)) {
    return "The extension was reloaded. Refresh this page and turn feedback mode on again.";
  }
  return message || fallback;
}
