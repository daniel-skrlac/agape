import { useSyncExternalStore } from "react";

export type QtyMap = Record<string, number>;

export type StandaloneItemMeta = {
  itemId: number;
  name?: string | null;
  code?: string | null;
  unit?: string | null;
  barcode?: string | null;
};

export type StandaloneMetaMap = Record<string, StandaloneItemMeta>;

export type ExtraDocDraft = {
  documentId: number;
  draft?: boolean | null;
  note?: string | null;
  items: Array<{ itemId: number; quantity: number }>;
};

type TouchedMap = Partial<Record<keyof EntryDraft, true>>;

export type EntryDraft = {
  sessionId: number;
  partnerId: number;
  draftMode: "DRAFT" | "FINAL";
  templateId: number | null;
  docPatches: any[];
  standaloneQty: QtyMap;
  standaloneMetaById: StandaloneMetaMap;
  extraDocs: ExtraDocDraft[];
  note?: string | null;
  documentDate?: any;
  _touched?: TouchedMap;
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

  const touched: TouchedMap = { ...(cur._touched ?? {}) };
  for (const k of Object.keys(patch) as Array<keyof EntryDraft>) touched[k] = true;

  drafts.set(keyOf(sessionId, partnerId), { ...cur, ...patch, _touched: touched });
  emit();
}

export function clearDraft(sessionId: number, partnerId: number) {
  drafts.delete(keyOf(sessionId, partnerId));
  emit();
}

export function clearDraftsForSession(sessionId: number) {
  const prefix = `${sessionId}:`;
  let changed = false;

  for (const k of Array.from(drafts.keys())) {
    if (!k.startsWith(prefix)) continue;
    drafts.delete(k);
    changed = true;
  }

  if (changed) emit();
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

export function ensureDraft(sessionId: number, partnerId: number): EntryDraft {
  const existing = getDraft(sessionId, partnerId);
  if (existing) return existing;

  const d: EntryDraft = {
    sessionId,
    partnerId,
    draftMode: "DRAFT",
    templateId: null,
    docPatches: [],
    standaloneQty: {},
    standaloneMetaById: {},
    extraDocs: [],
    note: null,
    documentDate: null,
    _touched: {},
  };

  setDraft(d);
  return d;
}

export function setDocPatches(sessionId: number, partnerId: number, next: any[]) {
  patchDraft(sessionId, partnerId, { docPatches: Array.isArray(next) ? [...next] : [] });
}
