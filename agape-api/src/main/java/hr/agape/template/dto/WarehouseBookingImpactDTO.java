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

    private Integer inOutFlag;      // SD_SIFREZ.ULAZIZLAZ (OTPREMNICA = 4)
    private Integer changesStock;   // SD_SIFREZ.MIJENJAZALIHU

    private boolean draft;

    // Draft affects pending only when MIJENJAZALIHU > 0 (legacy ZBROJI_NEPROK_ZALIHU filter)
    private boolean willAffectPending;

    private List<BookingImpactItemDTO> items;
}
