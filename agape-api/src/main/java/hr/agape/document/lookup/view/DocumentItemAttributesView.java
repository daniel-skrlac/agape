package hr.agape.document.lookup.view;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

/**
 * Immutable attributes required for inserting a line into SD_STAVKE that come
 * from the item master data.
 *
 * <p>Sourced from {@code SKL_ARTIKLIG}/{@code SKL_ARTIKLIZ}:</p>
 * <ul>
 *   <li>{@code NAZIV_ID} – item name/description id</li>
 *   <li>{@code JMJ_ID}   – unit of measure id</li>
 * </ul>
 */
@Data
@Builder
@AllArgsConstructor
public class DocumentItemAttributesView {
    Long nameId;
    Long unitOfMeasureId;
}
