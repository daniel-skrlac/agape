import { api } from "../api";
import type {
  BookingSessionEntryResponseDTO,
  BookingSessionScanEntryUpsertRequestDTO,
  BookingSessionScanValidateRequestDTO,
  BookingSessionScanValidateResponseDTO,
  DispatchSlipParsedDTO,
} from "@/src/models/generated";

const BASE = "/api/v1/dispatch-booking-sessions";

export type ParseDispatchSlipArgs = {
  sessionId: number;
  uri: string;
  name: string;
  mimeType: string;
  partnerId?: number | null;
  templateId?: number | null;
  documentDate?: string | null;
  note?: string | null;
  ocrText?: string | null;
};

export const dispatchSlipScanService = {
  parse: async (args: ParseDispatchSlipArgs) => {
    const form = new FormData();

    form.append("file", {
      uri: args.uri,
      name: args.name || "dispatch-slip.jpg",
      type: args.mimeType || "image/jpeg",
    } as any);

    if (args.partnerId) form.append("partnerId", String(args.partnerId));
    if (args.templateId) form.append("templateId", String(args.templateId));
    if (args.documentDate) form.append("documentDate", String(args.documentDate));
    if (args.note) form.append("note", String(args.note));
    if (args.ocrText) form.append("ocrText", String(args.ocrText));

    return api.upload<DispatchSlipParsedDTO>(
      `${BASE}/${args.sessionId}/entries/scan/parse`,
      form
    );
  },

  validate: (sessionId: number, payload: BookingSessionScanValidateRequestDTO) =>
    api.request<BookingSessionScanValidateResponseDTO>(
      `${BASE}/${sessionId}/entries/scan/validate`,
      {
        method: "POST",
        body: payload,
      }
    ),

  saveEntry: (sessionId: number, payload: BookingSessionScanEntryUpsertRequestDTO) =>
    api.request<BookingSessionEntryResponseDTO>(`${BASE}/${sessionId}/entries/scan`, {
      method: "PUT",
      body: payload,
    }),
};

export default dispatchSlipScanService;
