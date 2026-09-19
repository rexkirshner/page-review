export type ExtensionRequest =
  | { type: "capture-visible" }
  | { type: "image-put"; key: string; dataUrl: string }
  | { type: "image-get"; key: string }
  | { type: "image-delete"; key: string }
  | { type: "images-delete-draft"; draftId: string };

export type ExtensionResponse =
  | { ok: true; dataUrl?: string }
  | { ok: false; error: string };
