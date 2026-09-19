import type { Annotation, Draft, ScreenshotReference } from "./model";

function updateAnnotation(
  draft: Draft,
  annotationId: string,
  editedAt: string,
  update: (annotation: Annotation) => Annotation,
): Draft {
  let found = false;
  const annotations = draft.annotations.map((annotation) => {
    if (annotation.id !== annotationId) return annotation;
    found = true;
    return update(annotation);
  });
  if (!found) throw new Error(`Annotation ${annotationId} does not exist.`);
  return { ...draft, lastEditedAt: editedAt, annotations };
}

export function appendDraftAnnotation(draft: Draft, annotation: Annotation): Draft {
  if (draft.annotations.some((item) => item.id === annotation.id)) {
    throw new Error(`Annotation ${annotation.id} already exists.`);
  }
  return {
    ...draft,
    lastEditedAt: annotation.updatedAt,
    annotations: [...draft.annotations, annotation],
  };
}

export function editDraftAnnotationComment(draft: Draft, annotationId: string, comment: string, editedAt: string): Draft {
  return updateAnnotation(draft, annotationId, editedAt, (annotation) => ({
    ...annotation,
    comment,
    updatedAt: editedAt,
  }));
}

export function removeDraftAnnotation(draft: Draft, annotationId: string, editedAt: string): Draft {
  if (!draft.annotations.some((annotation) => annotation.id === annotationId)) {
    throw new Error(`Annotation ${annotationId} does not exist.`);
  }
  return {
    ...draft,
    lastEditedAt: editedAt,
    annotations: draft.annotations.filter((annotation) => annotation.id !== annotationId),
  };
}

export function setDraftAnnotationScreenshot(
  draft: Draft,
  annotationId: string,
  screenshot: ScreenshotReference | undefined,
  editedAt: string,
): Draft {
  return updateAnnotation(draft, annotationId, editedAt, (annotation) => {
    if (screenshot) return { ...annotation, screenshot, updatedAt: editedAt };
    const { screenshot: _screenshot, ...withoutScreenshot } = annotation;
    return { ...withoutScreenshot, updatedAt: editedAt };
  });
}
