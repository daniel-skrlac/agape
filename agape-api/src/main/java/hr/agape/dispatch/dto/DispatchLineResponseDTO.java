package hr.agape.dispatch.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchLineResponseDTO {

    private Long lineNumber;        // SD_STAVKE.RBR
    private Long itemId;            // SD_STAVKE.ARTIKL_ID
    private Double quantity;        // SD_STAVKE.KOLICINA
    private Long nameId;            // SD_STAVKE.NAZIV_ID
    private Long unitOfMeasureId;   // SD_STAVKE.JMJ_ID
    private Long valueAddedTaxId;   // SD_STAVKE.PDV_ID
}
