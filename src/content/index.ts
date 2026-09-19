import { buildZip, exportJson, exportMarkdown } from "../core/export";
import type { Annotation, Draft, ElementEvidence, PageContext, Rect, Settings, TargetEvidence } from "../core/model";
import { pageKey } from "../core/page-key";
import { captureElementEvidence, capturePageContext, captureTextEvidence, locateElement, locateText } from "../browser/dom-evidence";
import { clearDraft, clearStoredDraft, createDraft, loadDraft, loadSettings, saveDraft, saveSettings } from "../browser/persistence";
import { captureVisibleScreenshot, deleteScreenshot, getScreenshot, putScreenshot } from "../browser/screenshot";
import { styles } from "./styles";

type LocatedTarget = Element | Range;

interface CapturedScreenshot {
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: string;
}

interface NewAnnotation {
  id: string;
  type: Annotation["type"];
  context: PageContext;
  target?: TargetEvidence;
  located?: LocatedTarget;
  screenshot?: CapturedScreenshot;
  screenshotError?: string;
}

declare global {
  interface Window {
    __feedbackPacketController?: FeedbackController;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function imageKey(draft: Draft, annotationId: string): string {
  return `${draft.id}:${annotationId}`;
}

function rectsForTarget(target?: LocatedTarget): Rect[] {
  if (!target) return [];
  if (target instanceof Range) {
    return Array.from(target.getClientRects()).map((value) => ({ x: value.x, y: value.y, width: value.width, height: value.height }));
  }
  const value = target.getBoundingClientRect();
  return [{ x: value.x, y: value.y, width: value.width, height: value.height }];
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function download(name: string, content: string | Uint8Array, mime: string): void {
  const blob = new Blob([content as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.documentElement.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

class FeedbackController {
  private host: HTMLDivElement | undefined;
  private root: ShadowRoot | undefined;
  private draft!: Draft;
  private settings!: Settings;
  private located = new Map<string, LocatedTarget>();
  private active = false;
  private collapsed = false;
  private selectingElement = false;
  private candidate: Element | undefined;
  private pointer = { x: 0, y: 0 };
  private pending: NewAnnotation | undefined;
  private editingId: string | undefined;
  private status = "";
  private statusError = false;
  private warning = "";
  private flashId: string | undefined;
  private markerFrame = 0;
  private blockedDraftId: string | undefined;
  private writesBlocked = false;
  private editorComment = "";
  private attachScreenshot = false;
  private exportFormat: "md" | "json" = "md";

  async toggle(): Promise<void> {
    if (this.active) this.deactivate();
    else await this.activate();
  }

  private async activate(): Promise<void> {
    this.active = true;
    this.settings = await loadSettings();
    const key = pageKey(location.href);
    const result = await loadDraft(key, this.settings);
    if (result.status === "ok") this.draft = result.draft;
    else {
      this.draft = createDraft(key);
      if (result.status === "corrupt") {
        this.warning = `The saved draft is corrupt and was left unchanged. Clear feedback to replace it. ${result.reason}`;
        this.writesBlocked = true;
        this.blockedDraftId = result.draftId;
      }
      if (result.status === "unsupported") {
        this.warning = `This draft uses newer schema version ${result.version} and was left unchanged. Clear feedback to replace it.`;
        this.writesBlocked = true;
        this.blockedDraftId = result.draftId;
      }
      if ("expired" in result && result.expired) this.status = "The expired draft was deleted.";
    }
    this.createHost();
    await this.resolveTargets();
    this.addListeners();
    this.render();
  }

  private deactivate(): void {
    this.active = false;
    this.selectingElement = false;
    this.removeListeners();
    this.host?.remove();
    this.host = undefined;
    this.root = undefined;
    this.pending = undefined;
    this.editingId = undefined;
  }

  private createHost(): void {
    this.host = document.createElement("div");
    this.host.dataset.feedbackPacket = "";
    this.root = this.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = styles;
    this.root.append(style);
    document.documentElement.append(this.host);
  }

  private async resolveTargets(): Promise<void> {
    let changed = false;
    this.located.clear();
    for (const annotation of this.draft.annotations) {
      let target: LocatedTarget | undefined;
      if (annotation.target?.kind === "text") target = locateText(annotation.target);
      if (annotation.target?.kind === "element") target = locateElement(annotation.target);
      if (target) this.located.set(annotation.id, target);
      const resolution = annotation.type === "page" || target ? "resolved" : "unresolved";
      if (annotation.resolution !== resolution) { annotation.resolution = resolution; changed = true; }
    }
    if (changed) await saveDraft(this.draft);
  }

  private addListeners(): void {
    document.addEventListener("pointermove", this.onPointerMove, true);
    document.addEventListener("click", this.onDocumentClick, true);
    document.addEventListener("keydown", this.onKeyDown, true);
    window.addEventListener("scroll", this.onViewportChange, true);
    window.addEventListener("resize", this.onViewportChange);
  }

  private removeListeners(): void {
    document.removeEventListener("pointermove", this.onPointerMove, true);
    document.removeEventListener("click", this.onDocumentClick, true);
    document.removeEventListener("keydown", this.onKeyDown, true);
    window.removeEventListener("scroll", this.onViewportChange, true);
    window.removeEventListener("resize", this.onViewportChange);
    cancelAnimationFrame(this.markerFrame);
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.selectingElement || this.host?.contains(event.target as Node)) return;
    this.pointer = { x: event.clientX, y: event.clientY };
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (target && target !== this.host) {
      this.candidate = target;
      this.renderMarkers();
      this.updateSelectionControls();
    }
  };

  private onDocumentClick = (event: MouseEvent): void => {
    if (!this.selectingElement || this.host?.contains(event.target as Node)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const target = this.candidate ?? (event.target instanceof Element ? event.target : undefined);
    if (target) void this.startElementAnnotation(target);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.selectingElement) {
      this.selectingElement = false;
      this.candidate = undefined;
      this.render();
    }
  };

  private onViewportChange = (): void => {
    cancelAnimationFrame(this.markerFrame);
    this.markerFrame = requestAnimationFrame(() => this.renderMarkers());
  };

  private async capture(target: LocatedTarget | undefined): Promise<CapturedScreenshot> {
    return captureVisibleScreenshot(
      rectsForTarget(target),
      () => { if (this.host) this.host.style.visibility = "hidden"; },
      () => { if (this.host) this.host.style.visibility = ""; },
    );
  }

  private async startTextAnnotation(): Promise<void> {
    const selection = window.getSelection();
    const captured = selection ? captureTextEvidence(selection) : undefined;
    if (!captured) return this.setStatus("Select some page text first.", true);
    selection?.removeAllRanges();
    this.resetEditorState();
    this.pending = {
      id: crypto.randomUUID(), type: "text", context: capturePageContext(),
      target: captured.evidence, located: captured.range,
    };
    await this.capturePending();
  }

  private async startPageAnnotation(): Promise<void> {
    this.resetEditorState();
    this.pending = { id: crypto.randomUUID(), type: "page", context: capturePageContext() };
    await this.capturePending();
  }

  private async startElementAnnotation(element: Element): Promise<void> {
    this.selectingElement = false;
    this.candidate = undefined;
    this.resetEditorState();
    this.pending = {
      id: crypto.randomUUID(), type: "element", context: capturePageContext(),
      target: captureElementEvidence(element), located: element,
    };
    await this.capturePending();
  }

  private async capturePending(): Promise<void> {
    this.setStatus("Capturing the visible viewport…");
    try { this.pending!.screenshot = await this.capture(this.pending!.located); }
    catch (error) { this.pending!.screenshotError = error instanceof Error ? error.message : "Screenshot capture failed."; }
    this.status = "";
    this.render();
    requestAnimationFrame(() => this.root?.querySelector<HTMLTextAreaElement>("textarea")?.focus());
  }

  private beginElementSelection(): void {
    this.selectingElement = true;
    this.pending = undefined;
    this.editingId = undefined;
    this.candidate = undefined;
    this.render();
  }

  private broadenCandidate(): void {
    if (this.candidate?.parentElement && this.candidate.parentElement !== document.documentElement) {
      this.candidate = this.candidate.parentElement;
      this.renderMarkers();
      this.updateSelectionControls();
    }
  }

  private narrowCandidate(): void {
    if (!this.candidate) return;
    const hit = document.elementFromPoint(this.pointer.x, this.pointer.y);
    if (hit && hit !== this.candidate && this.candidate.contains(hit)) this.candidate = hit;
    else if (this.candidate.firstElementChild) this.candidate = this.candidate.firstElementChild;
    this.renderMarkers();
    this.updateSelectionControls();
  }

  private updateSelectionControls(): void {
    const parent = this.root?.querySelector<HTMLButtonElement>('button[data-action="parent"]');
    const child = this.root?.querySelector<HTMLButtonElement>('button[data-action="child"]');
    if (parent) parent.disabled = !this.candidate?.parentElement || this.candidate.parentElement === document.documentElement;
    if (child) child.disabled = !this.candidate?.firstElementChild;
  }

  private async saveEditor(): Promise<void> {
    this.syncEditorInputs();
    const comment = this.editorComment;
    if (!comment.trim()) return this.setStatus("Enter a comment before saving.", true);
    const now = new Date().toISOString();

    if (this.pending) {
      const pending = this.pending;
      const attach = this.attachScreenshot;
      const annotation: Annotation = {
        id: pending.id,
        type: pending.type,
        comment,
        createdAt: now,
        updatedAt: now,
        context: pending.context,
        target: pending.target,
        resolution: pending.type === "page" || pending.located ? "resolved" : "unresolved",
      };
      let storedScreenshot = false;
      if (attach && pending.screenshot) {
        try {
          await putScreenshot(imageKey(this.draft, annotation.id), pending.screenshot.dataUrl);
          storedScreenshot = true;
          annotation.screenshot = {
            filename: `${annotation.id}.png`,
            capturedAt: pending.screenshot.capturedAt,
            width: pending.screenshot.width,
            height: pending.screenshot.height,
          };
        } catch (error) {
          return this.setStatus(error instanceof Error ? error.message : "Screenshot storage failed.", true);
        }
      }
      const nextDraft: Draft = {
        ...this.draft,
        lastEditedAt: now,
        annotations: [...this.draft.annotations, annotation],
      };
      try {
        await saveDraft(nextDraft);
      } catch (error) {
        if (storedScreenshot) {
          try { await deleteScreenshot(imageKey(this.draft, annotation.id)); }
          catch (cleanupError) { console.warn("Could not roll back an unsaved screenshot.", cleanupError); }
        }
        throw error;
      }
      this.draft = nextDraft;
      if (pending.located) this.located.set(annotation.id, pending.located);
      this.pending = undefined;
    } else if (this.editingId) {
      const editingId = this.editingId;
      if (!this.draft.annotations.some((item) => item.id === editingId)) return;
      const nextDraft: Draft = {
        ...this.draft,
        lastEditedAt: now,
        annotations: this.draft.annotations.map((annotation) => annotation.id === editingId
          ? { ...annotation, comment, updatedAt: now }
          : annotation),
      };
      await saveDraft(nextDraft);
      this.draft = nextDraft;
      this.editingId = undefined;
    } else {
      return;
    }
    this.resetEditorState();
    this.setStatus("Comment saved.");
  }

  private async removeAnnotation(id: string): Promise<void> {
    const annotation = this.draft.annotations.find((item) => item.id === id);
    if (!annotation || !confirm("Delete this comment?")) return;
    if (annotation.screenshot) await deleteScreenshot(imageKey(this.draft, id));
    this.draft.annotations = this.draft.annotations.filter((item) => item.id !== id);
    this.draft.lastEditedAt = new Date().toISOString();
    this.located.delete(id);
    await saveDraft(this.draft);
    this.setStatus("Comment deleted.");
  }

  private async removeAnnotationScreenshot(id: string): Promise<void> {
    const annotation = this.draft.annotations.find((item) => item.id === id);
    if (!annotation?.screenshot) return;
    await deleteScreenshot(imageKey(this.draft, id));
    delete annotation.screenshot;
    const now = new Date().toISOString();
    annotation.updatedAt = now;
    this.draft.lastEditedAt = now;
    await saveDraft(this.draft);
    this.setStatus("Screenshot removed.");
  }

  private async recaptureScreenshot(id: string): Promise<void> {
    const annotation = this.draft.annotations.find((item) => item.id === id);
    if (!annotation) return;
    const target = this.located.get(id);
    if (annotation.type !== "page" && !target) return this.setStatus("The target is unresolved; the screenshot was not changed.", true);
    this.scrollTargetIntoView(target);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const screenshot = await this.capture(target);
      await putScreenshot(imageKey(this.draft, id), screenshot.dataUrl);
      annotation.screenshot = { filename: `${id}.png`, capturedAt: screenshot.capturedAt, width: screenshot.width, height: screenshot.height };
      const now = new Date().toISOString();
      annotation.updatedAt = now;
      this.draft.lastEditedAt = now;
      await saveDraft(this.draft);
      this.setStatus("Screenshot captured.");
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "Screenshot capture failed.", true);
    }
  }

  private scrollTargetIntoView(target?: LocatedTarget): void {
    if (!target) return;
    const element = target instanceof Range
      ? (target.commonAncestorContainer instanceof Element ? target.commonAncestorContainer : target.commonAncestorContainer.parentElement)
      : target;
    element?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }

  private focusAnnotation(id: string): void {
    const annotation = this.draft.annotations.find((item) => item.id === id);
    if (!annotation) return;
    if (annotation.type !== "page" && !this.located.has(id)) return this.setStatus("This target could not be located confidently.", true);
    this.scrollTargetIntoView(this.located.get(id));
    this.flashId = id;
    setTimeout(() => { this.flashId = undefined; this.renderMarkers(); }, 1700);
    this.renderMarkers();
  }

  private async exportFeedback(copyOnly: boolean): Promise<void> {
    if (!this.draft.annotations.length) return this.setStatus("Add at least one comment before exporting.", true);
    const format = this.exportFormat;
    const exportedAt = new Date().toISOString();
    const text = format === "json" ? exportJson(this.draft, exportedAt) : exportMarkdown(this.draft, exportedAt);
    const screenshots = this.draft.annotations.filter((item) => item.screenshot);

    if (copyOnly) {
      await this.copyText(text);
      return this.setStatus(screenshots.length ? "Feedback copied. Download is required to include screenshots." : "Feedback copied.");
    }

    const stem = `feedback-${exportedAt.slice(0, 10)}`;
    if (!screenshots.length) {
      download(`${stem}.${format}`, text, format === "json" ? "application/json" : "text/markdown");
      return this.setStatus("Feedback downloaded.");
    }

    const images: Record<string, Uint8Array> = {};
    for (const annotation of screenshots) {
      const dataUrl = await getScreenshot(imageKey(this.draft, annotation.id));
      if (!dataUrl || !annotation.screenshot) return this.setStatus(`Screenshot ${annotation.id} is missing; export stopped.`, true);
      images[annotation.screenshot.filename] = dataUrlBytes(dataUrl);
    }
    download(`${stem}.zip`, buildZip(`feedback.${format}`, text, images), "application/zip");
    this.setStatus("Feedback ZIP downloaded.");
  }

  private async copyText(text: string): Promise<void> {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Use the local fallback. */ }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    this.root?.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Clipboard access was denied.");
  }

  private async clearAll(): Promise<void> {
    if (!confirm("Clear all feedback for this page? This cannot be undone.")) return;
    if (this.writesBlocked) await clearStoredDraft(this.draft.pageKey, this.blockedDraftId);
    else await clearDraft(this.draft);
    this.draft = createDraft(pageKey(location.href));
    this.writesBlocked = false;
    this.blockedDraftId = undefined;
    this.warning = "";
    this.located.clear();
    this.pending = undefined;
    this.editingId = undefined;
    this.setStatus("Feedback cleared.");
  }

  private setStatus(message: string, error = false): void {
    this.status = message;
    this.statusError = error;
    this.render();
  }

  private render(): void {
    if (!this.root) return;
    this.root.querySelector(".fp-panel")?.remove();
    const panel = document.createElement("section");
    panel.className = `fp-panel${this.collapsed ? " collapsed" : ""}`;
    panel.setAttribute("aria-label", "Feedback Packet");
    panel.innerHTML = this.panelHtml();
    panel.addEventListener("click", (event) => void this.handlePanelClick(event).catch((error) => {
      this.setStatus(error instanceof Error ? error.message : "The action failed.", true);
    }));
    panel.addEventListener("input", (event) => this.handlePanelInput(event));
    panel.addEventListener("change", (event) => void this.handlePanelChange(event).catch((error) => {
      this.setStatus(error instanceof Error ? error.message : "The setting could not be saved.", true);
    }));
    this.root.append(panel);
    this.renderMarkers();
  }

  private panelHtml(): string {
    const count = this.draft.annotations.length;
    if (this.collapsed) return `<header class="fp-head"><span class="fp-title">Feedback</span><span class="fp-count">${count}</span><button data-action="collapse" aria-label="Expand panel">+</button><button data-action="off" aria-label="Turn off feedback mode">×</button></header>`;
    const editor = this.editorHtml();
    return `
      <header class="fp-head"><span class="fp-title">Feedback</span><span class="fp-count">${count}</span><button data-action="collapse" aria-label="Collapse panel">−</button><button data-action="off" aria-label="Turn off feedback mode">×</button></header>
      <div class="fp-body">
        ${this.warning ? `<div class="fp-warning">${escapeHtml(this.warning)}</div>` : ""}
        <div class="fp-actions">
          <button class="fp-button primary" data-action="text" ${this.writesBlocked ? "disabled" : ""}>Comment on selection</button>
          <button class="fp-button" data-action="element" ${this.writesBlocked ? "disabled" : ""}>Select element</button>
          <button class="fp-button wide" data-action="page" ${this.writesBlocked ? "disabled" : ""}>Add page comment</button>
        </div>
        ${this.selectingElement ? `<div class="fp-selecting">Move over the page, then click the intended element. Press Escape to cancel.<div class="fp-select-controls"><button class="fp-button" data-action="parent" ${this.candidate?.parentElement ? "" : "disabled"}>Parent</button><button class="fp-button" data-action="child" ${this.candidate?.firstElementChild ? "" : "disabled"}>Child</button><button class="fp-button" data-action="cancel-select">Cancel</button></div></div>` : ""}
        ${editor}
        <div class="fp-section"><span class="fp-label">Comments</span>${this.listHtml()}</div>
        <div class="fp-section fp-footer">
          <select id="fp-format" aria-label="Export format"><option value="md" ${this.exportFormat === "md" ? "selected" : ""}>Markdown</option><option value="json" ${this.exportFormat === "json" ? "selected" : ""}>JSON</option></select>
          <button class="fp-button primary" data-action="download">Download</button>
          <button class="fp-button" data-action="copy">Copy feedback</button>
          <button class="fp-button danger" data-action="clear">Clear feedback</button>
          <label class="fp-retention">Delete inactive drafts after <select id="fp-retention"><option value="7" ${this.settings.retentionDays === 7 ? "selected" : ""}>7 days</option><option value="30" ${this.settings.retentionDays === 30 ? "selected" : ""}>30 days</option><option value="90" ${this.settings.retentionDays === 90 ? "selected" : ""}>90 days</option><option value="never" ${this.settings.retentionDays === null ? "selected" : ""}>Never</option></select></label>
        </div>
        ${this.status ? `<p class="fp-status${this.statusError ? " error" : ""}" role="status">${escapeHtml(this.status)}</p>` : ""}
      </div>`;
  }

  private editorHtml(): string {
    const existing = this.editingId ? this.draft.annotations.find((item) => item.id === this.editingId) : undefined;
    if (!this.pending && !existing) return "";
    const screenshotLine = this.pending
      ? (this.pending.screenshot
        ? `<label class="fp-check"><input id="fp-attach" type="checkbox" ${this.attachScreenshot ? "checked" : ""}> Attach screenshot</label>`
        : this.pending.screenshotError
          ? `<p class="fp-status error">Screenshot unavailable: ${escapeHtml(this.pending.screenshotError)}</p>`
          : `<p class="fp-status">Capturing screenshot…</p>`)
      : "";
    const capturePending = Boolean(this.pending && !this.pending.screenshot && !this.pending.screenshotError);
    return `<div class="fp-section"><div class="fp-editor"><label class="fp-label" for="fp-comment">Comment</label><textarea id="fp-comment">${escapeHtml(this.editorComment)}</textarea>${screenshotLine}<div class="fp-editor-actions"><button class="fp-button" data-action="cancel-editor">Cancel</button><button class="fp-button primary" data-action="save" ${capturePending ? "disabled" : ""}>Save comment</button></div></div></div>`;
  }

  private listHtml(): string {
    if (!this.draft.annotations.length) return `<p class="fp-empty">No comments on this page.</p>`;
    return `<div class="fp-list">${this.draft.annotations.map((annotation, index) => `
      <article class="fp-row">
        <span class="fp-number">${index + 1}</span>
        <button class="fp-comment" data-action="focus" data-id="${annotation.id}">
          <div class="fp-comment-text">${escapeHtml(annotation.comment)}</div>
          <div class="fp-meta">${annotation.type}${annotation.resolution === "unresolved" ? ` · <span class="fp-unresolved">unresolved</span>` : ""}${annotation.screenshot ? " · screenshot" : ""}</div>
        </button>
        <div class="fp-row-menu">
          <button data-action="edit" data-id="${annotation.id}" aria-label="Edit comment ${index + 1}">Edit</button>
          <button data-action="recapture" data-id="${annotation.id}">${annotation.screenshot ? "Recapture" : "Capture"}</button>
          ${annotation.screenshot ? `<button data-action="remove-shot" data-id="${annotation.id}">Remove image</button>` : ""}
          <button data-action="delete" data-id="${annotation.id}" aria-label="Delete comment ${index + 1}">Delete</button>
        </div>
      </article>`).join("")}</div>`;
  }

  private renderMarkers(): void {
    if (!this.root) return;
    this.root.querySelectorAll(".fp-target, .fp-preview").forEach((element) => element.remove());
    this.draft.annotations.forEach((annotation, index) => {
      const target = this.located.get(annotation.id);
      const boxes = rectsForTarget(target).filter((box) => box.width > 0 && box.height > 0);
      boxes.forEach((box, boxIndex) => {
        const marker = document.createElement("div");
        marker.className = `fp-target${this.flashId === annotation.id ? " flash" : ""}`;
        marker.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px`;
        if (boxIndex === 0) marker.innerHTML = `<span class="badge">${index + 1}</span>`;
        this.root!.append(marker);
      });
    });
    if (this.selectingElement && this.candidate) {
      const box = this.candidate.getBoundingClientRect();
      const preview = document.createElement("div");
      preview.className = "fp-preview";
      preview.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px`;
      this.root.append(preview);
    }
    if (this.pending?.located) {
      rectsForTarget(this.pending.located).forEach((box) => {
        const marker = document.createElement("div");
        marker.className = "fp-preview";
        marker.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px`;
        this.root!.append(marker);
      });
    }
  }

  private async handlePanelClick(event: Event): Promise<void> {
    const target = (event.target as Element).closest<HTMLElement>("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (action === "collapse") { this.collapsed = !this.collapsed; this.render(); }
    if (action === "off") this.deactivate();
    if (action === "text") await this.startTextAnnotation();
    if (action === "element") this.beginElementSelection();
    if (action === "page") await this.startPageAnnotation();
    if (action === "parent") this.broadenCandidate();
    if (action === "child") this.narrowCandidate();
    if (action === "cancel-select") { this.selectingElement = false; this.candidate = undefined; this.render(); }
    if (action === "cancel-editor") { this.pending = undefined; this.editingId = undefined; this.resetEditorState(); this.render(); }
    if (action === "save") await this.saveEditor();
    if (action === "focus" && id) this.focusAnnotation(id);
    if (action === "edit" && id) {
      const annotation = this.draft.annotations.find((item) => item.id === id);
      if (!annotation) return;
      this.editingId = id;
      this.pending = undefined;
      this.editorComment = annotation.comment;
      this.attachScreenshot = false;
      this.render();
      requestAnimationFrame(() => this.root?.querySelector<HTMLTextAreaElement>("textarea")?.focus());
    }
    if (action === "delete" && id) await this.removeAnnotation(id);
    if (action === "recapture" && id) await this.recaptureScreenshot(id);
    if (action === "remove-shot" && id) await this.removeAnnotationScreenshot(id);
    if (action === "download") await this.exportFeedback(false);
    if (action === "copy") await this.exportFeedback(true);
    if (action === "clear") await this.clearAll();
  }

  private async handlePanelChange(event: Event): Promise<void> {
    const target = event.target as HTMLSelectElement;
    if (target.id === "fp-format") {
      this.exportFormat = target.value === "json" ? "json" : "md";
      return;
    }
    if (target.id !== "fp-retention") return;
    this.settings.retentionDays = target.value === "never" ? null : Number(target.value) as 7 | 30 | 90;
    await saveSettings(this.settings);
    this.setStatus("Retention setting saved.");
  }

  private handlePanelInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && target.id === "fp-comment") this.editorComment = target.value;
    if (target instanceof HTMLInputElement && target.id === "fp-attach") this.attachScreenshot = target.checked;
  }

  private syncEditorInputs(): void {
    const textarea = this.root?.querySelector<HTMLTextAreaElement>("#fp-comment");
    const attach = this.root?.querySelector<HTMLInputElement>("#fp-attach");
    if (textarea) this.editorComment = textarea.value;
    if (attach) this.attachScreenshot = attach.checked;
  }

  private resetEditorState(): void {
    this.editorComment = "";
    this.attachScreenshot = false;
  }
}

if (window.__feedbackPacketController) {
  void window.__feedbackPacketController.toggle();
} else {
  window.__feedbackPacketController = new FeedbackController();
  void window.__feedbackPacketController.toggle();
}
