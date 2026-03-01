import type { WarehouseBookingImpactDTO, DispatchRequestValidationDTO } from "@/src/models/generated";
import { api } from "../api";
import { DispatchBulkValidationRequestDTO, DispatchBulkValidationResponseDTO } from "@/src/models/generated";

export const dispatchValidateService = {
    validate(payload: DispatchRequestValidationDTO, signal?: AbortSignal) {
        return api.request<WarehouseBookingImpactDTO>("/api/v1/dispatch/validate", {
            method: "POST",
            body: payload,
            signal,
        });
    },
      validateBulk(payload: DispatchBulkValidationRequestDTO, signal?: AbortSignal) {
    return api.request<DispatchBulkValidationResponseDTO>("/api/v1/dispatch/validate/bulk", {
      method: "POST",
      body: payload,
      signal,
    });
  },
};
