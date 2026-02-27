import type { WarehouseBookingImpactDTO, DispatchRequestValidationDTO } from "@/src/models/generated";
import { api } from "../api";

export const dispatchValidateService = {
    validate(payload: DispatchRequestValidationDTO, signal?: AbortSignal) {
        return api.request<WarehouseBookingImpactDTO>("/api/v1/dispatch/validate", {
            method: "POST",
            body: payload,
            signal,
        });
    },
};
