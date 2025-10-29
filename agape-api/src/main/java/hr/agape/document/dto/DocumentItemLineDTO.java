package hr.agape.document.dto;


import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Fully-resolved line ready for insertion into {@code SD_STAVKE}.
 *
 * <p>All NOT NULL fields are present and derived up-front by the service:</p>
 * <ul>
 *   <li>{@code itemId}, {@code quantity} – from the API request</li>
 *   <li>{@code nazivId}, {@code jmjId}   – from item master (SKL_ARTIKLIG/IZ)</li>
 *   <li>{@code pdvId}                    – from document rules (SD_SIFREG → SKLADISTE)</li>
 *   <li>{@code lineNumber}               – sequential per header</li>
 * </ul>
 */
@Builder
@Data
@AllArgsConstructor
public class DocumentItemLineDTO {
    private Long itemId;              // ARTIKL_ID
    private BigDecimal quantity;      // KOLICINA
    private Long nameId;              // NAZIV_ID
    private Long unitOfMeasureId;     // JMJ_ID
    private Long valueAddedTaxId;     // PDV_ID
}
