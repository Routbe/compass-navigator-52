export function hasUnpublishedDraft(draftRevision: number, publishedRevision: number): boolean {
  return draftRevision !== publishedRevision;
}

export function assertExpectedDraftRevision(current: number, expected: number): void {
  if (current !== expected) throw new Error("draft_conflict");
}