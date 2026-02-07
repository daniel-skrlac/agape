package hr.agape.dispatch.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchBookingItemDTO {
    private Long itemRowId;      // SD_STAVKE.ID
    private Long itemId;         // SD_STAVKE.ARTIKL_ID
    private Long nazivId;        // SD_STAVKE.NAZIV_ID

    private String itemCode;     // SKL_ARTIKLIZ.ARTIKLID
    private String name;         // SKL_ANAZIVI.NAZIV
    private String unit;         // SIFRE_JMJ.JEDINICAMJERE

    private BigDecimal quantity; // SD_STAVKE.KOLICINA
}
