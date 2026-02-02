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
} from "@/app/models/generated";

export const dispatchTemplateService = {
  listFolders(signal?: AbortSignal) {
    return api.request<FolderResponseDTO[]>("/api/v1/dispatch-template-folders", { method: "GET", signal });
  },
  createFolder(payload: FolderCreateRequestDTO, signal?: AbortSignal) {
    return api.request<FolderResponseDTO>("/api/v1/dispatch-template-folders", { method: "POST", body: payload, signal });
  },
  renameFolder(id: number, payload: FolderRenameRequestDTO, signal?: AbortSignal) {
    return api.request<FolderResponseDTO>(`/api/v1/dispatch-template-folders/${id}`, { method: "PUT", body: payload, signal });
  },
  deleteFolder(id: number, signal?: AbortSignal) {
    return api.request<void>(`/api/v1/dispatch-template-folders/${id}`, { method: "DELETE", signal });
  },

  listTemplates(
    params: { folderId?: number | null; name?: string; includeShared?: boolean; rootOnly?: boolean },
    signal?: AbortSignal
  ) {
    const q = new URLSearchParams();

    if (params.folderId !== undefined && params.folderId !== null) q.set("folderId", String(params.folderId));

    if (params.name) q.set("name", params.name);
    if (params.includeShared !== undefined) q.set("includeShared", String(params.includeShared));

    if (params.rootOnly === true) q.set("rootOnly", "true");

    const qs = q.toString();
    return api.request<TemplateResponseDTO[]>(
      `/api/v1/dispatch-templates${qs ? `?${qs}` : ""}`,
      { method: "GET", signal }
    );
  },
  getTemplate(id: number, signal?: AbortSignal) {
    return api.request<TemplateResponseDTO>(`/api/v1/dispatch-templates/${id}`, { method: "GET", signal });
  },
  createTemplate(payload: TemplateCreateRequestDTO, signal?: AbortSignal) {
    return api.request<TemplateResponseDTO>("/api/v1/dispatch-templates", { method: "POST", body: payload, signal });
  },
  updateTemplate(id: number, payload: TemplateUpdateRequestDTO, signal?: AbortSignal) {
    return api.request<TemplateResponseDTO>(`/api/v1/dispatch-templates/${id}`, { method: "PUT", body: payload, signal });
  },
  deleteTemplate(id: number, signal?: AbortSignal) {
    return api.request<void>(`/api/v1/dispatch-templates/${id}`, { method: "DELETE", signal });
  },

  upsertTemplateDoc(templateId: number, payload: TemplateDocUpsertRequestDTO, signal?: AbortSignal) {
    return api.request<TemplateResponseDTO>(`/api/v1/dispatch-templates/${templateId}/documents`, { method: "POST", body: payload, signal });
  },
  replaceTemplateDocItems(templateId: number, templateDocId: number, items: TemplateItemUpsertRequestDTO[], signal?: AbortSignal) {
    return api.request<TemplateResponseDTO>(`/api/v1/dispatch-templates/${templateId}/documents/${templateDocId}/items`, { method: "PUT", body: items, signal });
  },

  listShares(templateId: number, signal?: AbortSignal) {
    return api.request<TemplateShareResponseDTO[]>(`/api/v1/dispatch-templates/${templateId}/shares`, { method: "GET", signal });
  },
  shareTemplate(templateId: number, payload: TemplateShareCreateRequestDTO, signal?: AbortSignal) {
    return api.request<TemplateShareResponseDTO>(`/api/v1/dispatch-templates/${templateId}/shares`, { method: "POST", body: payload, signal });
  },
  revokeShare(templateId: number, shareId: number, signal?: AbortSignal) {
    return api.request<void>(`/api/v1/dispatch-templates/${templateId}/shares/${shareId}`, { method: "DELETE", signal });
  },
  copyTemplate(templateId: number, payload: TemplateCopyRequestDTO, signal?: AbortSignal) {
    return api.request<TemplateResponseDTO>(`/api/v1/dispatch-templates/${templateId}/copy`, { method: "POST", body: payload, signal });
  },

  bookOne(payload: TemplateBookOneRequestDTO, signal?: AbortSignal) {
    return api.request<DispatchBulkResponseDTO>("/api/v1/dispatch-template-booking/", { method: "POST", body: payload, signal });
  },
  bookMany(payload: TemplateBookManyRequestDTO, signal?: AbortSignal) {
    return api.request<DispatchBulkResponseDTO>("/api/v1/dispatch-template-booking/bulk", { method: "POST", body: payload, signal });
  },
  deleteTemplateDoc(templateId: number, templateDocId: number, signal?: AbortSignal) {
    return api.request<void>(
      `/api/v1/dispatch-templates/${templateId}/documents/${templateDocId}`,
      { method: "DELETE", signal }
    );
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
    return api.request<any>(`/api/v1/dispatch-template/${templateId}/move`, {
      method: "PUT",
      body: payload,
      signal,
    });
  },
};
