import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toUserMessage } from "@/app/api/apiClient";

import type {
  FolderCreateRequestDTO,
  FolderRenameRequestDTO,
  FolderResponseDTO,
  TemplateCreateRequestDTO,
  TemplateUpdateRequestDTO,
  TemplateResponseDTO,
  TemplateDocUpsertRequestDTO,
  TemplateItemUpsertRequestDTO,
  TemplateShareCreateRequestDTO,
  TemplateShareResponseDTO,
  TemplateCopyRequestDTO,
  TemplateBookOneRequestDTO,
  TemplateBookManyRequestDTO,
  DispatchBulkResponseDTO,
  FolderCopyRequestDTO,
  PagedResultDTO,
} from "@/src/models/generated";
import { TemplateListScope, dispatchTemplateService } from "../../services/dispatchTemplateService";

const qk = {
  folders: (params: { parentId: number | null; size: number }) =>
    ["dispatch-template-folders", params] as const,

  foldersTree: () => ["dispatch-template-folders", "tree"] as const,

  templatesHeaders: (params: {
    folderId: number | null;
    q: string;
    scope: TemplateListScope;
    rootOnly: boolean;
    size: number;
  }) => ["dispatch-templates", "headers", params] as const,

  templateDetail: (id: number) => ["dispatch-template", id] as const,
  templateShares: (templateId: number) => ["dispatch-template-shares", templateId] as const,
};

function getNextPageParam<T>(lastPage: PagedResultDTO<T>) {
  const page = Number(lastPage?.page ?? 0);
  const size = Number(lastPage?.size ?? 0);
  const total = Number(lastPage?.total ?? 0);

  if (!size) return undefined;

  const loaded = (page + 1) * size;
  return loaded < total ? page + 1 : undefined;
}

function flattenPages<T>(pages?: PagedResultDTO<T>[]) {
  return (pages ?? []).flatMap((p) => p?.items ?? []);
}

export function canEditDeleteTemplate(input: {
  shared?: boolean | null;
  sharedPermission?: "VIEW" | "BOOK" | null;
}) {
  return !input.shared;
}

type UseTemplateFoldersArgs = {
  parentId?: number | null;
  size?: number;
  enabled?: boolean;
};

export function useTemplateFolders(args: UseTemplateFoldersArgs = {}) {
  const {
    parentId = null,
    size = 20,
    enabled = true,
  } = args;

  const query = useInfiniteQuery({
    queryKey: qk.folders({ parentId, size }),
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      dispatchTemplateService.listFoldersPage(
        {
          parentId,
          page: Number(pageParam ?? 0),
          size,
        },
        signal
      ),
    getNextPageParam,
  });

  const data = useMemo(
    () => flattenPages<FolderResponseDTO>(query.data?.pages as PagedResultDTO<FolderResponseDTO>[] | undefined),
    [query.data]
  );

  const loadMore = useCallback(async () => {
    if (!query.hasNextPage || query.isFetchingNextPage) return;
    await query.fetchNextPage();
  }, [query]);

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const clearStatus = useCallback(() => {
  }, []);

  return {
    data,
    isLoading: query.isLoading,
    loading: query.isFetching,
    error: query.isError ? query.error : null,

    canLoadMore: !!query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMoreError: query.isFetchNextPageError ? toUserMessage(query.error, "Greška pri učitavanju više mapa.") : null,

    loadMore,
    refresh,
    refetch: query.refetch,
    clearStatus,
  };
}

type UseTemplateListArgs = {
  folderId?: number | null;
  q?: string;
  scope?: TemplateListScope;
  includeShared?: boolean;
  rootOnly?: boolean;
  size?: number;
  enabled?: boolean;
};

export function useTemplateList(args: UseTemplateListArgs) {
  const {
    folderId = null,
    q = "",
    scope,
    includeShared = true,
    rootOnly = false,
    size = 20,
    enabled = true,
  } = args;

  const effectiveScope: TemplateListScope = scope ?? (includeShared ? "ALL" : "OWNED");

  const query = useInfiniteQuery({
    queryKey: qk.templatesHeaders({
      folderId,
      q: q.trim(),
      scope: effectiveScope,
      rootOnly,
      size,
    }),
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      dispatchTemplateService.listTemplateHeadersPaged(
        {
          folderId,
          q,
          scope: effectiveScope,
          rootOnly,
          page: Number(pageParam ?? 0),
          size,
        },
        signal
      ),
    getNextPageParam,
  });

  const data = useMemo(
    () => flattenPages<TemplateResponseDTO>(query.data?.pages as PagedResultDTO<TemplateResponseDTO>[] | undefined),
    [query.data]
  );

  const loadMore = useCallback(async () => {
    if (!query.hasNextPage || query.isFetchingNextPage) return;
    await query.fetchNextPage();
  }, [query]);

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const clearStatus = useCallback(() => {
  }, []);

  return {
    data,
    isLoading: query.isLoading,
    loading: query.isFetching,
    error: query.isError ? query.error : null,

    canLoadMore: !!query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMoreError: query.isFetchNextPageError ? toUserMessage(query.error, "Greška pri učitavanju više predložaka.") : null,

    loadMore,
    refresh,
    refetch: query.refetch,
    clearStatus,
  };
}

type UseTemplateDetailOptions = {
  includeItemMeta?: boolean;
};

export function useTemplateDetail(
  id: number | null,
  options: UseTemplateDetailOptions = {}
) {
  const includeItemMeta = options.includeItemMeta ?? false;

  const query = useQuery({
    queryKey: id
      ? ["dispatch-template", id, { includeItemMeta }]
      : ["dispatch-template", "null", { includeItemMeta }],
    enabled: id != null,
    queryFn: ({ signal }) =>
      dispatchTemplateService.getTemplate(Number(id), signal, { includeItemMeta }),
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    errorMessage: query.error
      ? toUserMessage(query.error, "Greška prilikom učitavanja predloška.")
      : null,
    refetch: query.refetch,
  };
}

export function useCreateFolder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: FolderCreateRequestDTO) => dispatchTemplateService.createFolder(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dispatch-template-folders"] });
    },
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (v: { id: number; payload: FolderRenameRequestDTO }) =>
      dispatchTemplateService.renameFolder(v.id, v.payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dispatch-template-folders"] });
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
    },
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => dispatchTemplateService.deleteFolder(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dispatch-template-folders"] });
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
    },
  });
}

export function useCopyFolder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (v: { folderId: number; payload: FolderCopyRequestDTO }) =>
      dispatchTemplateService.copyFolderTree(v.folderId, v.payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dispatch-template-folders"] });
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
    },
  });
}

export function useMoveFolder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (v: { folderId: number; payload: { targetParentId: number | null } }) =>
      dispatchTemplateService.moveFolder(v.folderId, v.payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dispatch-template-folders"] });
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: TemplateCreateRequestDTO) => dispatchTemplateService.createTemplate(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
    },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (v: { id: number; payload: TemplateUpdateRequestDTO }) =>
      dispatchTemplateService.updateTemplate(v.id, v.payload),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
      await qc.invalidateQueries({ queryKey: qk.templateDetail(vars.id) });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => dispatchTemplateService.deleteTemplate(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
      await qc.invalidateQueries({ queryKey: ["dispatch-template-folders"] });
    },
  });
}

export function useMoveTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (v: { templateId: number; payload: { targetFolderId: number | null } }) =>
      dispatchTemplateService.moveTemplate(v.templateId, v.payload),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
      await qc.invalidateQueries({ queryKey: ["dispatch-template-folders"] });
      await qc.invalidateQueries({ queryKey: qk.templateDetail(vars.templateId) });
    },
  });
}

export function useCopyTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (v: { templateId: number; payload: TemplateCopyRequestDTO }) =>
      dispatchTemplateService.copyTemplate(v.templateId, v.payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
      await qc.invalidateQueries({ queryKey: ["dispatch-template-folders"] });
    },
  });
}

export function useUpsertTemplateDoc() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (v: { templateId: number; payload: TemplateDocUpsertRequestDTO }) =>
      dispatchTemplateService.upsertTemplateDoc(v.templateId, v.payload),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: qk.templateDetail(vars.templateId) });
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
    },
  });
}

export function useReplaceTemplateDocItems() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (v: {
      templateId: number;
      templateDocId: number;
      items: TemplateItemUpsertRequestDTO[];
    }) =>
      dispatchTemplateService.replaceTemplateDocItems(v.templateId, v.templateDocId, v.items),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: qk.templateDetail(vars.templateId) });
    },
  });
}

export function useDeleteTemplateDoc() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (v: { templateId: number; templateDocId: number }) =>
      dispatchTemplateService.deleteTemplateDoc(v.templateId, v.templateDocId),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: qk.templateDetail(vars.templateId) });
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
    },
  });
}

export function useTemplateShares(templateId: number | null) {
  const query = useQuery({
    queryKey: templateId ? qk.templateShares(templateId) : ["dispatch-template-shares", "null"],
    enabled: !!templateId,
    queryFn: ({ signal }) => dispatchTemplateService.listShares(Number(templateId), signal),
  });

  return {
    data: (query.data ?? []) as TemplateShareResponseDTO[],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    errorMessage: query.error ? toUserMessage(query.error, "Greška prilikom učitavanja dijeljenja.") : null,
    refetch: query.refetch,
  };
}

export function useShareTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (v: { templateId: number; payload: TemplateShareCreateRequestDTO }) =>
      dispatchTemplateService.shareTemplate(v.templateId, v.payload),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: qk.templateShares(vars.templateId) });
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
      await qc.invalidateQueries({ queryKey: qk.templateDetail(vars.templateId) });
    },
  });
}

export function useRevokeTemplateShare() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (v: { templateId: number; shareId: number }) =>
      dispatchTemplateService.revokeShare(v.templateId, v.shareId),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: qk.templateShares(vars.templateId) });
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
      await qc.invalidateQueries({ queryKey: qk.templateDetail(vars.templateId) });
    },
  });
}

export function useBookTemplateOne() {
  return useMutation({
    mutationFn: (payload: TemplateBookOneRequestDTO) =>
      dispatchTemplateService.bookOne(payload) as Promise<DispatchBulkResponseDTO>,
  });
}

export function useBookTemplateMany() {
  return useMutation({
    mutationFn: (payload: TemplateBookManyRequestDTO) =>
      dispatchTemplateService.bookMany(payload) as Promise<DispatchBulkResponseDTO>,
  });
}

export function useTemplateFolderTree(args: { enabled?: boolean } = {}) {
  const { enabled = true } = args;

  const query = useQuery({
    queryKey: qk.foldersTree(),
    enabled,
    queryFn: ({ signal }) => dispatchTemplateService.listFolderTree(signal),
  });

  return {
    data: (query.data ?? []) as FolderResponseDTO[],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    errorMessage: query.error ? toUserMessage(query.error, "Greška prilikom učitavanja mapa.") : null,
    refetch: query.refetch,
    clearStatus: () => { },
  };
}