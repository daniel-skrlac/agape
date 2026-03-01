import { api } from "../api";
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

export type TemplateListScope = "ALL" | "OWNED" | "SHARED";

export type TemplateHeaderListParams = {
  folderId?: number | null;
  q?: string;
  scope?: TemplateListScope;
  rootOnly?: boolean;
  page?: number;
  size?: number;
};

export const dispatchTemplateService = {
  listFoldersPage(
    params?: { parentId?: number | null; q?: string; page?: number; size?: number },
    signal?: AbortSignal
  ) {
    const search = new URLSearchParams();

    if (params?.parentId !== undefined && params.parentId !== null) {
      search.set("parentId", String(params.parentId));
    }

    if (params?.q?.trim()) {
      search.set("q", params.q.trim());
    }

    search.set("page", String(params?.page ?? 0));
    search.set("size", String(params?.size ?? 20));

    const qs = search.toString();

    return api.request<PagedResultDTO<FolderResponseDTO>>(
      `/api/v1/dispatch-template-folders${qs ? `?${qs}` : ""}`,
      { method: "GET", signal }
    );
  },

  listRootFolders(
    params?: { q?: string },
    signal?: AbortSignal
  ) {
    const search = new URLSearchParams();

    if (params?.q?.trim()) {
      search.set("q", params.q.trim());
    }

    const qs = search.toString();

    return api.request<FolderResponseDTO[]>(
      `/api/v1/dispatch-template-folders/root${qs ? `?${qs}` : ""}`,
      { method: "GET", signal }
    );
  },

  listFolderTree(signal?: AbortSignal) {
    return api.request<FolderResponseDTO[]>("/api/v1/dispatch-template-folders/tree", {
      method: "GET",
      signal,
    });
  },

  createFolder(payload: FolderCreateRequestDTO, signal?: AbortSignal) {
    return api.request<FolderResponseDTO>("/api/v1/dispatch-template-folders", {
      method: "POST",
      body: payload,
      signal,
    });
  },

  renameFolder(id: number, payload: FolderRenameRequestDTO, signal?: AbortSignal) {
    return api.request<FolderResponseDTO>(`/api/v1/dispatch-template-folders/${id}`, {
      method: "PUT",
      body: payload,
      signal,
    });
  },

  deleteFolder(id: number, signal?: AbortSignal) {
    return api.request<void>(`/api/v1/dispatch-template-folders/${id}`, {
      method: "DELETE",
      signal,
    });
  },

  listTemplates(
    params: { folderId?: number | null; q?: string; includeShared?: boolean; rootOnly?: boolean },
    signal?: AbortSignal
  ) {
    const search = new URLSearchParams();

    if (params.folderId !== undefined && params.folderId !== null) {
      search.set("folderId", String(params.folderId));
    }
    if (params.q?.trim()) {
      search.set("q", params.q.trim());
    }
    if (params.includeShared !== undefined) {
      search.set("includeShared", String(params.includeShared));
    }
    if (params.rootOnly === true) {
      search.set("rootOnly", "true");
    }

    const qs = search.toString();

    return api.request<TemplateResponseDTO[]>(
      `/api/v1/dispatch-templates${qs ? `?${qs}` : ""}`,
      { method: "GET", signal }
    );
  },

  getTemplate(
    id: number,
    signal?: AbortSignal,
    options?: { includeItemMeta?: boolean }
  ) {
    const includeItemMeta = options?.includeItemMeta ?? false;
    const qs = includeItemMeta ? "?includeItemMeta=true" : "";

    return api.request<TemplateResponseDTO>(`/api/v1/dispatch-templates/${id}${qs}`, {
      method: "GET",
      signal,
    });
  },

  createTemplate(payload: TemplateCreateRequestDTO, signal?: AbortSignal) {
    return api.request<TemplateResponseDTO>("/api/v1/dispatch-templates", {
      method: "POST",
      body: payload,
      signal,
    });
  },

  updateTemplate(id: number, payload: TemplateUpdateRequestDTO, signal?: AbortSignal) {
    return api.request<TemplateResponseDTO>(`/api/v1/dispatch-templates/${id}`, {
      method: "PUT",
      body: payload,
      signal,
    });
  },

  deleteTemplate(id: number, signal?: AbortSignal) {
    return api.request<void>(`/api/v1/dispatch-templates/${id}`, {
      method: "DELETE",
      signal,
    });
  },

  upsertTemplateDoc(templateId: number, payload: TemplateDocUpsertRequestDTO, signal?: AbortSignal) {
    return api.request<TemplateResponseDTO>(`/api/v1/dispatch-templates/${templateId}/documents`, {
      method: "POST",
      body: payload,
      signal,
    });
  },

  replaceTemplateDocItems(
    templateId: number,
    templateDocId: number,
    items: TemplateItemUpsertRequestDTO[],
    signal?: AbortSignal
  ) {
    return api.request<TemplateResponseDTO>(
      `/api/v1/dispatch-templates/${templateId}/documents/${templateDocId}/items`,
      { method: "PUT", body: items, signal }
    );
  },

  listShares(templateId: number, signal?: AbortSignal) {
    return api.request<TemplateShareResponseDTO[]>(`/api/v1/dispatch-templates/${templateId}/shares`, {
      method: "GET",
      signal,
    });
  },

  shareTemplate(templateId: number, payload: TemplateShareCreateRequestDTO, signal?: AbortSignal) {
    return api.request<TemplateShareResponseDTO>(`/api/v1/dispatch-templates/${templateId}/shares`, {
      method: "POST",
      body: payload,
      signal,
    });
  },

  revokeShare(templateId: number, shareId: number, signal?: AbortSignal) {
    return api.request<void>(`/api/v1/dispatch-templates/${templateId}/shares/${shareId}`, {
      method: "DELETE",
      signal,
    });
  },

  copyTemplate(templateId: number, payload: TemplateCopyRequestDTO, signal?: AbortSignal) {
    return api.request<TemplateResponseDTO>(`/api/v1/dispatch-templates/${templateId}/copy`, {
      method: "POST",
      body: payload,
      signal,
    });
  },

  bookOne(payload: TemplateBookOneRequestDTO, signal?: AbortSignal) {
    return api.request<DispatchBulkResponseDTO>("/api/v1/dispatch-template-booking/", {
      method: "POST",
      body: payload,
      signal,
    });
  },

  bookMany(payload: TemplateBookManyRequestDTO, signal?: AbortSignal) {
    return api.request<DispatchBulkResponseDTO>("/api/v1/dispatch-template-booking/bulk", {
      method: "POST",
      body: payload,
      signal,
    });
  },

  deleteTemplateDoc(templateId: number, templateDocId: number, signal?: AbortSignal) {
    return api.request<void>(`/api/v1/dispatch-templates/${templateId}/documents/${templateDocId}`, {
      method: "DELETE",
      signal,
    });
  },

  copyFolderTree(folderId: number, payload: FolderCopyRequestDTO, signal?: AbortSignal) {
    return api.request<any>(`/api/v1/dispatch-template-folders/${folderId}/copy`, {
      method: "POST",
      body: payload,
      signal,
    });
  },

  moveFolder(folderId: number, payload: { targetParentId: number | null }, signal?: AbortSignal) {
    return api.request<any>(`/api/v1/dispatch-template-folders/${folderId}/move`, {
      method: "PUT",
      body: payload,
      signal,
    });
  },

  moveTemplate(templateId: number, payload: { targetFolderId: number | null }, signal?: AbortSignal) {
    return api.request<TemplateResponseDTO>(`/api/v1/dispatch-templates/${templateId}/move`, {
      method: "PUT",
      body: payload,
      signal,
    });
  },

  listTemplateHeadersPaged(
    params: TemplateHeaderListParams,
    signal?: AbortSignal
  ): Promise<PagedResultDTO<TemplateResponseDTO>> {
    const search = new URLSearchParams();

    if (params.folderId != null) {
      search.set("folderId", String(params.folderId));
    }
    if (params.q?.trim()) {
      search.set("q", params.q.trim());
    }

    search.set("scope", params.scope ?? "ALL");
    search.set("rootOnly", String(!!params.rootOnly));
    search.set("page", String(params.page ?? 0));
    search.set("size", String(params.size ?? 20));

    return api.request<PagedResultDTO<TemplateResponseDTO>>(
      `/api/v1/dispatch-templates/headers?${search.toString()}`,
      {
        method: "GET",
        signal,
      }
    );
  },
};