import { useMutation } from "@tanstack/react-query";
import type { DispatchRequestDTO, WarehouseBookingImpactDTO } from "@/app/models/generated";
import { dispatchValidateService } from "@/app/api/services/dispatchValidateService";

export function useDispatchValidate() {
    return useMutation<WarehouseBookingImpactDTO, Error, DispatchRequestDTO>({
        mutationFn: (payload) => dispatchValidateService.validate(payload),
    });
}
