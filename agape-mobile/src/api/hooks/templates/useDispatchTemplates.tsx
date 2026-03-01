import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toUserMessage } from "../../../../src/api/apiClient";

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
  foldersRoot: (q: string) => ["dispatch-template-folders", "root", q] as const,
  foldersPage: (parentId: number | null, q: string, size: number) =>
    ["dispatch-template-folders", "page", parentId ?? "root", q, size] as const,
  foldersTree: () => ["dispatch-template-folders", "tree"] as const,

  templatesHeaders: (params: {
    folderId: number | null;
    q: string;
    scope: TemplateListScope;
    rootOnly: boolean;
    size: number;
  }) =>
    [
      "dispatch-templates",
      "headers",
      params.folderId ?? "root",
      params.scope,
      params.rootOnly ? 1 : 0,
      params.size,
      params.q,
    ] as const,

  templateDetail: (id: number, includeItemMeta: boolean) =>
    ["dispatch-template", id, includeItemMeta ? 1 : 0] as const,

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

/**
 * UI expects “can edit/delete only if not shared”
 */
export function canEditDeleteTemplate(input: {
  shared?: boolean | null;
  sharedPermission?: "VIEW" | "BOOK" | null;
}) {
  return !input.shared;
}

type UseTemplateFoldersArgs = {
  parentId?: number | null;
  q?: string;
  size?: number;
  enabled?: boolean;
  loadAllRoot?: boolean;
};

export function useTemplateFolders(args: UseTemplateFoldersArgs = {}) {
  const {
    parentId = null,
    q = "",
    size = 20,
    enabled = true,
    loadAllRoot = false,
  } = args;

  const normalizedQ = q.trim();
  const useRootEndpoint = loadAllRoot && parentId == null;

  const rootQuery = useQuery({
    queryKey: qk.foldersRoot(normalizedQ),
    enabled: enabled && useRootEndpoint,
    queryFn: ({ signal }) => dispatchTemplateService.listRootFolders({ q: normalizedQ }, signal),
  });

  const pagedQuery = useInfiniteQuery({
    queryKey: qk.foldersPage(parentId, normalizedQ, size),
    enabled: enabled && !useRootEndpoint,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      dispatchTemplateService.listFoldersPage(
        {
          parentId,
          q: normalizedQ,
          page: Number(pageParam ?? 0),
          size,
        },
        signal
      ),
    getNextPageParam,
  });

  const data = useMemo(() => {
    const rows = useRootEndpoint
      ? ((rootQuery.data ?? []) as FolderResponseDTO[])
      : flattenPages<FolderResponseDTO>(
        pagedQuery.data?.pages as PagedResultDTO<FolderResponseDTO>[] | undefined
      );

    const needle = normalizedQ.toLowerCase();
    if (!needle) return rows;

    return rows.filter((x: any) => String(x?.name ?? "").toLowerCase().includes(needle));
  }, [useRootEndpoint, rootQuery.data, pagedQuery.data, normalizedQ]);

  const loadMore = useCallback(async () => {
    if (useRootEndpoint) return;
    if (!pagedQuery.hasNextPage || pagedQuery.isFetchingNextPage) return;
    await pagedQuery.fetchNextPage();
  }, [useRootEndpoint, pagedQuery]);

  const refresh = useCallback(async () => {
    if (useRootEndpoint) {
      await rootQuery.refetch();
      return;
    }
    await pagedQuery.refetch();
  }, [useRootEndpoint, rootQuery, pagedQuery]);

  const clearStatus = useCallback(() => { }, []);

  return {
    data,
    isLoading: useRootEndpoint ? rootQuery.isLoading : pagedQuery.isLoading,
    loading: useRootEndpoint ? rootQuery.isFetching : pagedQuery.isFetching,
    error: useRootEndpoint
      ? (rootQuery.error ?? null)
      : (pagedQuery.isError ? pagedQuery.error : null),

    canLoadMore: useRootEndpoint ? false : !!pagedQuery.hasNextPage,
    loadingMore: useRootEndpoint ? false : pagedQuery.isFetchingNextPage,
    loadMoreError: useRootEndpoint
      ? null
      : pagedQuery.isFetchNextPageError
        ? toUserMessage(pagedQuery.error, "Greška pri učitavanju više mapa.")
        : null,

    loadMore,
    refresh,
    refetch: useRootEndpoint ? rootQuery.refetch : pagedQuery.refetch,
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
  const normalizedQ = q.trim();

  const query = useInfiniteQuery({
    queryKey: qk.templatesHeaders({
      folderId,
      q: normalizedQ,
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
          q: normalizedQ,
          scope: effectiveScope,
          rootOnly,
          page: Number(pageParam ?? 0),
          size,
        },
        signal
      ),
    getNextPageParam,
  });

  const data = useMemo(() => {
    const rows = flattenPages<TemplateResponseDTO>(
      query.data?.pages as PagedResultDTO<TemplateResponseDTO>[] | undefined
    );

    const needle = normalizedQ.toLowerCase();
    if (!needle) return rows;

    return rows.filter((x: any) => String(x?.name ?? "").toLowerCase().includes(needle));
  }, [query.data, normalizedQ]);

  const loadMore = useCallback(async () => {
    if (!query.hasNextPage || query.isFetchingNextPage) return;
    await query.fetchNextPage();
  }, [query]);

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const clearStatus = useCallback(() => { }, []);

  return {
    data,
    isLoading: query.isLoading,
    loading: query.isFetching,
    error: query.isError ? query.error : null,

    canLoadMore: !!query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMoreError: query.isFetchNextPageError
      ? toUserMessage(query.error, "Greška pri učitavanju više predložaka.")
      : null,

    loadMore,
    refresh,
    refetch: query.refetch,
    clearStatus,
  };
}

type UseTemplateDetailOptions = {
  includeItemMeta?: boolean;
};

export function useTemplateDetail(id: number | null, options: UseTemplateDetailOptions = {}) {
  const includeItemMeta = options.includeItemMeta ?? false;

  const query = useQuery({
    queryKey: id != null ? qk.templateDetail(Number(id), includeItemMeta) : ["dispatch-template", "null"],
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
      await qc.invalidateQueries({ queryKey: ["dispatch-template", vars.id] });
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
      await qc.invalidateQueries({ queryKey: ["dispatch-template", vars.templateId] });
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
      await qc.invalidateQueries({ queryKey: ["dispatch-template", vars.templateId] });
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
    },
  });
}

export function useReplaceTemplateDocItems() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (v: { templateId: number; templateDocId: number; items: TemplateItemUpsertRequestDTO[] }) =>
      dispatchTemplateService.replaceTemplateDocItems(v.templateId, v.templateDocId, v.items),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ["dispatch-template", vars.templateId] });
    },
  });
}

export function useDeleteTemplateDoc() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (v: { templateId: number; templateDocId: number }) =>
      dispatchTemplateService.deleteTemplateDoc(v.templateId, v.templateDocId),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ["dispatch-template", vars.templateId] });
      await qc.invalidateQueries({ queryKey: ["dispatch-templates", "headers"] });
    },
  });
}

export function useTemplateShares(templateId: number | null) {
  const query = useQuery({
    queryKey: templateId ? qk.templateShares(Number(templateId)) : ["dispatch-template-shares", "null"],
    enabled: !!templateId,
    queryFn: ({ signal }) => dispatchTemplateService.listShares(Number(templateId), signal),
  });

  return {
    data: (query.data ?? []) as TemplateShareResponseDTO[],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    errorMessage: query.error
      ? toUserMessage(query.error, "Greška prilikom učitavanja dijeljenja.")
      : null,
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
      await qc.invalidateQueries({ queryKey: ["dispatch-template", vars.templateId] });
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
      await qc.invalidateQueries({ queryKey: ["dispatch-template", vars.templateId] });
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
    errorMessage: query.error
      ? toUserMessage(query.error, "Greška prilikom učitavanja mapa.")
      : null,
    refetch: query.refetch,
    clearStatus: () => { },
  };
}