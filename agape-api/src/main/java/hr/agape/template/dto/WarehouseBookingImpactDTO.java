package hr.agape.template.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WarehouseBookingImpactDTO {
    private Long warehouseId;
    private Long documentId;
    private String documentCode;

    /**
     * inOutFlag is needed to explain direction (OTPREMNICA = 4 = OUT).
     */
    private Integer inOutFlag;

    private boolean draft;

    /**
     * Only items with real changes (non-zero deltas) are returned.
     */
    private List<BookingImpactItemDTO> items;
}
