import { api } from "../api";
import type {
  BookingSessionEntryResponseDTO,
  DispatchSlipParsedDTO,
  DispatchSlipScanCorrectionRequestDTO,
  DispatchSlipScanSessionEntryRequestDTO,
  DispatchSlipScanUploadResponseDTO,
} from "@/src/models/generated";

const BASE = "/api/v1/dispatch-slip-scans";

export type UploadDispatchSlipArgs = {
  uri: string;
  name: string;
  mimeType: string;
  bookingSessionId?: number | null;
  partnerId?: number | null;
  templateId?: number | null;
  warehouseId?: number | null;
};

export const dispatchSlipScanService = {
  upload: async (args: UploadDispatchSlipArgs) => {
    const form = new FormData();

    form.append("file", {
      uri: args.uri,
      name: args.name || "dispatch-slip.jpg",
      type: args.mimeType || "image/jpeg",
    } as any);

    if (args.bookingSessionId) form.append("bookingSessionId", String(args.bookingSessionId));
    if (args.partnerId) form.append("partnerId", String(args.partnerId));
    if (args.templateId) form.append("templateId", String(args.templateId));
    if (args.warehouseId) form.append("warehouseId", String(args.warehouseId));

    return api.upload<DispatchSlipScanUploadResponseDTO>(BASE, form);
  },

  get: (id: number) => api.request<DispatchSlipParsedDTO>(`${BASE}/${id}`, { method: "GET" }),

  correct: (id: number, payload: DispatchSlipScanCorrectionRequestDTO) =>
    api.request<DispatchSlipParsedDTO>(`${BASE}/${id}/corrections`, {
      method: "PUT",
      body: payload,
    }),

  saveSessionEntry: (id: number, payload: DispatchSlipScanSessionEntryRequestDTO) =>
    api.request<BookingSessionEntryResponseDTO>(`${BASE}/${id}/session-entry`, {
      method: "POST",
      body: payload,
    }),
};

export default dispatchSlipScanService;
