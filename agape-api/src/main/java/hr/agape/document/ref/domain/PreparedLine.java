package hr.agape.document.ref.domain;


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
public class PreparedLine {
    Integer itemId;
    BigDecimal quantity;
    Integer nameId;
    Integer unitOfMeasureId;
    Integer valueAddedTaxId;
    Integer lineNumber;
}
