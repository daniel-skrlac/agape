import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dispatchTemplateService } from "../services/dispatchTemplateService";
import type {
  FolderRenameRequestDTO,
  TemplateCreateRequestDTO,
  TemplateUpdateRequestDTO,
  TemplateDocUpsertRequestDTO,
  TemplateItemUpsertRequestDTO,
  TemplateShareCreateRequestDTO,
  TemplateCopyRequestDTO,
  TemplateBookOneRequestDTO,
  TemplateBookManyRequestDTO,
} from "@/app/models/generated";

const keys = {
  folders: ["tpl-folders"] as const,
  list: (args: any) => ["tpl-list", args] as const,
  one: (id: number) => ["tpl-one", id] as const,
  shares: (id: number) => ["tpl-shares", id] as const,
};

export function canEditDeleteTemplate(t: { shared?: boolean; sharedPermission?: "VIEW" | "BOOK" | null }) {
  if (!t.shared) return true; // owner
  return t.sharedPermission === "BOOK"; // shared: samo BOOK može edit/delete
}

export function useTemplateFolders() {
  return useQuery({
    queryKey: keys.folders,
    queryFn: ({ signal }) => dispatchTemplateService.listFolders(signal),
    retry: 1,

    // ✅ ključ: nemoj "trepnuti" na back
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; parentId?: number | null }) => dispatchTemplateService.createFolder(payload as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.folders }),
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number; payload: FolderRenameRequestDTO }) => dispatchTemplateService.renameFolder(args.id, args.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.folders }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => dispatchTemplateService.deleteFolder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.folders }),
  });
}

/**
 * list templates:
 * - rootOnly se smije slati SAMO kad folderId==null
 * - includeShared: true/false po modu
 */
export function useTemplateList(args: { folderId: number | null | undefined; q: string; includeShared: boolean; rootOnly: boolean }) {
  const folderId = args.folderId ?? null;
  const rootOnly = folderId == null ? args.rootOnly : false;

  return useQuery({
    queryKey: keys.list({ folderId, q: args.q, includeShared: args.includeShared, rootOnly }),
    queryFn: ({ signal }) =>
      dispatchTemplateService.listTemplates(
        { folderId, name: args.q.trim() || undefined, includeShared: args.includeShared, rootOnly },
        signal
      ),
    retry: 1,

    // ✅ ključ: drži stare rezultate dok refetch traje
    placeholderData: (prev) => prev,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useTemplate(id: number) {
  return useQuery({
    queryKey: keys.one(id),
    queryFn: ({ signal }) => dispatchTemplateService.getTemplate(id, signal),
    retry: 1,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TemplateCreateRequestDTO) => dispatchTemplateService.createTemplate(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tpl-list"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number; payload: TemplateUpdateRequestDTO }) => dispatchTemplateService.updateTemplate(args.id, args.payload),
    onSuccess: (_t, args) => {
      qc.invalidateQueries({ queryKey: keys.one(args.id) });
      qc.invalidateQueries({ queryKey: ["tpl-list"] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => dispatchTemplateService.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tpl-list"] }),
  });
}

export function useUpsertDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { templateId: number; payload: TemplateDocUpsertRequestDTO }) => dispatchTemplateService.upsertTemplateDoc(args.templateId, args.payload),
    onSuccess: (t) => qc.invalidateQueries({ queryKey: keys.one(t.id) }),
  });
}

export function useReplaceItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { templateId: number; docId: number; items: TemplateItemUpsertRequestDTO[] }) =>
      dispatchTemplateService.replaceTemplateDocItems(args.templateId, args.docId, args.items),
    onSuccess: (t) => qc.invalidateQueries({ queryKey: keys.one(t.id) }),
  });
}

export function useShares(templateId: number) {
  return useQuery({
    queryKey: keys.shares(templateId),
    queryFn: ({ signal }) => dispatchTemplateService.listShares(templateId, signal),
    retry: 1,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useShare(templateId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TemplateShareCreateRequestDTO) => dispatchTemplateService.shareTemplate(templateId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.shares(templateId) }),
  });
}

export function useRevokeShare(templateId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shareId: number) => dispatchTemplateService.revokeShare(templateId, shareId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.shares(templateId) }),
  });
}

export function useCopyTemplate(templateId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TemplateCopyRequestDTO) => dispatchTemplateService.copyTemplate(templateId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tpl-list"] }),
  });
}

export function useBookOne() {
  return useMutation({
    mutationFn: (payload: TemplateBookOneRequestDTO) => dispatchTemplateService.bookOne(payload),
  });
}

export function useBookMany() {
  return useMutation({
    mutationFn: (payload: TemplateBookManyRequestDTO) => dispatchTemplateService.bookMany(payload),
  });
}

export function useDeleteDoc() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (args: { templateId: number; templateDocId: number }) =>
      dispatchTemplateService.deleteTemplateDoc(args.templateId, args.templateDocId),

    onSuccess: (_res, args) => {
      qc.invalidateQueries({ queryKey: keys.one(args.templateId) });
      qc.invalidateQueries({ queryKey: ["tpl-list"] });
    },
  });
}
