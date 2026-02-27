import { useMutation } from "@tanstack/react-query";
import type {
    DispatchRequestValidationDTO,
    WarehouseBookingImpactDTO,
} from "@/src/models/generated";
import { dispatchValidateService } from "@/app/api/services/dispatchValidateService";

export function useDispatchValidate() {
    return useMutation<WarehouseBookingImpactDTO, Error, DispatchRequestValidationDTO>({
        mutationFn: (payload) => dispatchValidateService.validate(payload),
    });
}