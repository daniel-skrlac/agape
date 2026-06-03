import {api} from "../api";
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
    name?: string | null;
    mimeType?: string | null;
    partnerId?: number | null;
    templateId?: number | null;
    documentDate?: string | null;
    note?: string | null;
};

export const dispatchSlipScanService = {
    parse: async (args: ParseDispatchSlipArgs) => {
        const form = new FormData();

        form.append("file", {
            uri: args.uri,
            name: args.name || "otpremnica.jpg",
            type: args.mimeType || "image/jpeg",
        } as any);

        if (args.partnerId != null) {
            form.append("partnerId", String(args.partnerId));
        }

        if (args.templateId != null) {
            form.append("templateId", String(args.templateId));
        }

        if (args.documentDate && args.documentDate.trim()) {
            form.append("documentDate", args.documentDate.trim());
        }

        if (args.note && args.note.trim()) {
            form.append("note", args.note.trim());
        }

        return api.upload<DispatchSlipParsedDTO>(
            `${BASE}/${args.sessionId}/entries/scan/parse`,
            form,
            {timeoutMs: 150_000}
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
        api.request<BookingSessionEntryResponseDTO>(
            `${BASE}/${sessionId}/entries/scan`,
            {
                method: "PUT",
                body: payload,
            }
        ),
};

export default dispatchSlipScanService;
