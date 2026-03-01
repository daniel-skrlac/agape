import { useMutation } from "@tanstack/react-query";
import type {
    DispatchRequestValidationDTO,
    WarehouseBookingImpactDTO,
} from "@/src/models/generated";
import { dispatchValidateService } from "../../services/dispatchValidateService";
import { DispatchBulkValidationResponseDTO, DispatchBulkValidationRequestDTO } from "@/src/models/generated";

export function useDispatchValidate() {
    return useMutation<WarehouseBookingImpactDTO, Error, DispatchRequestValidationDTO>({
        mutationFn: (payload) => dispatchValidateService.validate(payload),
    });
}

export function useDispatchValidateBulk() {
    return useMutation<DispatchBulkValidationResponseDTO, Error, DispatchBulkValidationRequestDTO>({
        mutationFn: (payload) => dispatchValidateService.validateBulk(payload),
    });
}