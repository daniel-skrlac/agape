import { useSyncExternalStore } from "react";

export type QtyMap = Record<string, number>;

export type EntryDraft = {
  sessionId: number;
  partnerId: number;

  draftMode: "DRAFT" | "FINAL";
  templateId: number | null;

  docPatches: any[];
  standaloneQty: QtyMap;

  note?: string | null;
  documentDate?: any;
};

type Key = string;

const drafts = new Map<Key, EntryDraft>();
const listeners = new Set<() => void>();

function keyOf(sessionId: number, partnerId: number) {
  return `${sessionId}:${partnerId}`;
}

function emit() {
  listeners.forEach((l) => l());
}

export function getDraft(sessionId: number, partnerId: number): EntryDraft | null {
  return drafts.get(keyOf(sessionId, partnerId)) ?? null;
}

export function setDraft(d: EntryDraft) {
  drafts.set(keyOf(d.sessionId, d.partnerId), d);
  emit();
}

export function patchDraft(sessionId: number, partnerId: number, patch: Partial<EntryDraft>) {
  const cur = getDraft(sessionId, partnerId);
  if (!cur) return;
  drafts.set(keyOf(sessionId, partnerId), { ...cur, ...patch });
  emit();
}

export function clearDraft(sessionId: number, partnerId: number) {
  drafts.delete(keyOf(sessionId, partnerId));
  emit();
}

export function useEntryDraft(sessionId: number, partnerId: number) {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => getDraft(sessionId, partnerId),
    () => getDraft(sessionId, partnerId)
  );
}
