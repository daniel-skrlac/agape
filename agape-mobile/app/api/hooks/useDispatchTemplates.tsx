import { useCallback, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dispatchTemplateService } from "../services/dispatchTemplateService";
import { toUserMessage } from "@/app/api/apiClient";
import type {
  FolderCreateRequestDTO,
  FolderRenameRequestDTO,
  FolderResponseDTO,
  FolderCopyRequestDTO,
  PagedResultDTO,
  TemplateCopyRequestDTO,
  TemplateCreateRequestDTO,
  TemplateUpdateRequestDTO,
  TemplateDocUpsertRequestDTO,
  TemplateItemUpsertRequestDTO,
  TemplateShareCreateRequestDTO,
  TemplateBookOneRequestDTO,
  TemplateBookManyRequestDTO,
} from "@/app/models/generated";

const keys = {
  foldersBase: ["tpl-folders"] as const,

  foldersPage: (args: { parentId: number | null; page: number; size: number }) =>
    ["tpl-folders", "page", args] as const,

  foldersInfinite: (args: { parentId: number | null; size: number }) =>
    ["tpl-folders", "infinite", args] as const,

  foldersTree: ["tpl-folders", "tree"] as const,

  list: (args: any) => ["tpl-list", args] as const,
  one: (id: number) => ["tpl-one", id] as const,
  shares: (id: number) => ["tpl-shares", id] as const,
};

type FolderListArgs = {
  parentId?: number | null;
  size?: number;
};

export function canEditDeleteTemplate(t: { shared?: boolean; sharedPermission?: "VIEW" | "BOOK" | null }) {
  if (!t.shared) return true;
  return t.sharedPermission === "BOOK";
}

export function useTemplateFoldersPage(args?: { parentId?: number | null; page?: number; size?: number }) {
  const parentId = args?.parentId ?? null;
  const page = args?.page ?? 0;
  const size = args?.size ?? 20;

  return useQuery({
    queryKey: keys.foldersPage({ parentId, page, size }),
    queryFn: ({ signal }) => dispatchTemplateService.listFoldersPage({ parentId, page, size }, signal),
    retry: 1,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });
}

export function useTemplateFolders(args?: FolderListArgs) {
  const parentId = args?.parentId ?? null;
  const size = args?.size ?? 20;

  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const q = useInfiniteQuery({
    queryKey: keys.foldersInfinite({ parentId, size }),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      dispatchTemplateService.listFoldersPage(
        { parentId, page: Number(pageParam ?? 0), size },
        signal
      ),
    getNextPageParam: (lastPage, allPages) => {
      const lastItems = (lastPage?.items ?? []) as FolderResponseDTO[];
      const pageSize = Number(lastPage?.size ?? size) || size;
      const currentPage = Number(lastPage?.page ?? 0);

      const loadedCount = allPages.reduce((sum, p) => sum + Number((p?.items ?? []).length), 0);
      const totalRaw = Number(lastPage?.total ?? 0);
      const hasReliableTotal = Number.isFinite(totalRaw) && totalRaw > 0;

      if (lastItems.length === 0) return undefined;

      if (hasReliableTotal && loadedCount >= totalRaw) return undefined;

      if (lastItems.length < pageSize) return undefined;

      return currentPage + 1;
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const items = useMemo<FolderResponseDTO[]>(() => {
    const pages = q.data?.pages ?? [];
    return pages.flatMap((p) => ((p?.items ?? []) as FolderResponseDTO[]));
  }, [q.data?.pages]);

  const lastPage = q.data?.pages?.[q.data.pages.length - 1] as PagedResultDTO<FolderResponseDTO> | undefined;

  const total = useMemo(() => {
    const t = Number(lastPage?.total ?? 0);
    return t > 0 ? t : items.length;
  }, [lastPage, items.length]);

  const page = useMemo(() => Number(lastPage?.page ?? 0), [lastPage]);

  const clearStatus = useCallback(() => {
    setLoadMoreError(null);
  }, []);

  const refresh = useCallback(async () => {
    setLoadMoreError(null);
    await q.refetch();
  }, [q]);

  const loadMore = useCallback(async () => {
    if (!q.hasNextPage) return;
    if (q.isFetchingNextPage) return;

    setLoadMoreError(null);
    try {
      await q.fetchNextPage();
    } catch (e) {
      setLoadMoreError(toUserMessage(e, "Greška prilikom učitavanja dodatnih mapa."));
    }
  }, [q]);

  return {
    data: items,
    items,

    page,
    size,
    total,

    isLoading: q.isPending,
    loading: q.isPending,
    loadingMore: q.isFetchingNextPage,
    fetching: q.isFetching,

    error: q.error,
    loadMoreError,

    canLoadMore: !!q.hasNextPage,

    refetch: q.refetch,
    refresh,
    loadMore,

    clearStatus,
  };
}

export function useTemplateFolderTree() {
  return useQuery({
    queryKey: keys.foldersTree,
    queryFn: ({ signal }) => dispatchTemplateService.listFolderTree(signal),
    retry: 1,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FolderCreateRequestDTO) => dispatchTemplateService.createFolder(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.foldersBase }),
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number; payload: FolderRenameRequestDTO }) =>
      dispatchTemplateService.renameFolder(args.id, args.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.foldersBase }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => dispatchTemplateService.deleteFolder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.foldersBase }),
  });
}

export function useTemplateList(args: {
  folderId: number | null | undefined;
  q: string;
  includeShared: boolean;
  rootOnly: boolean;
}) {
  const folderId = args.folderId ?? null;
  const rootOnly = folderId == null ? args.rootOnly : false;

  return useQuery({
    queryKey: keys.list({ folderId, q: args.q, includeShared: args.includeShared, rootOnly }),
    queryFn: ({ signal }) =>
      dispatchTemplateService.listTemplates(
        {
          folderId,
          name: args.q.trim() || undefined,
          includeShared: args.includeShared,
          rootOnly,
        },
        signal
      ),
    retry: 1,
    placeholderData: (prev) => prev,
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
    mutationFn: (args: { id: number; payload: TemplateUpdateRequestDTO }) =>
      dispatchTemplateService.updateTemplate(args.id, args.payload),
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
    mutationFn: (args: { templateId: number; payload: TemplateDocUpsertRequestDTO }) =>
      dispatchTemplateService.upsertTemplateDoc(args.templateId, args.payload),
    onSuccess: (t) => qc.invalidateQueries({ queryKey: keys.one(t.id) }),
  });
}

export function useReplaceItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      templateId: number;
      docId: number;
      items: TemplateItemUpsertRequestDTO[];
    }) => dispatchTemplateService.replaceTemplateDocItems(args.templateId, args.docId, args.items),
    onSuccess: (t) => qc.invalidateQueries({ queryKey: keys.one(t.id) }),
  });
}

export function useShares(templateId: number) {
  return useQuery({
    queryKey: keys.shares(templateId),
    queryFn: ({ signal }) => dispatchTemplateService.listShares(templateId, signal),
    retry: 1,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });
}

export function useShare(templateId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TemplateShareCreateRequestDTO) =>
      dispatchTemplateService.shareTemplate(templateId, payload),
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

export function useTemplate(id: number) {
  return useQuery({
    queryKey: keys.one(id),
    queryFn: ({ signal }) => dispatchTemplateService.getTemplate(id, signal),
    retry: 1,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });
}

export function useMoveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { templateId: number; payload: { targetFolderId: number | null } }) =>
      dispatchTemplateService.moveTemplate(args.templateId, args.payload),
    onSuccess: (_res, args) => {
      qc.invalidateQueries({ queryKey: keys.one(args.templateId) });
      qc.invalidateQueries({ queryKey: ["tpl-list"] });
    },
  });
}

export function useCopyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { templateId: number; payload: TemplateCopyRequestDTO }) =>
      dispatchTemplateService.copyTemplate(args.templateId, args.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tpl-list"] }),
  });
}

export function useMoveFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { folderId: number; payload: { targetParentId: number | null } }) =>
      dispatchTemplateService.moveFolder(args.folderId, args.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.foldersBase });
      qc.invalidateQueries({ queryKey: ["tpl-list"] });
    },
  });
}

export function useCopyFolderTree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { folderId: number; payload: FolderCopyRequestDTO }) =>
      dispatchTemplateService.copyFolderTree(args.folderId, args.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.foldersBase });
      qc.invalidateQueries({ queryKey: ["tpl-list"] });
    },
  });
}