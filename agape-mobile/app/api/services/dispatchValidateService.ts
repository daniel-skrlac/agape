import type { WarehouseBookingImpactDTO, DispatchRequestDTO } from "@/app/models/generated";
import { api } from "../api";

export const dispatchValidateService = {
    validate(payload: DispatchRequestDTO, signal?: AbortSignal) {
        return api.request<WarehouseBookingImpactDTO>("/api/v1/dispatch/validate", {
            method: "POST",
            body: payload,
            signal,
        });
    },
};
