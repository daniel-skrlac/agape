package hr.agape.dispatch.dto;

import hr.agape.template.dto.WarehouseBookingImpactDTO;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class DispatchBulkValidationRowDTO {
    private Long partnerId;
    private Long warehouseId;
    private Long documentId;
    private String documentCode;
    private WarehouseBookingImpactDTO data;
    private String error;
}
