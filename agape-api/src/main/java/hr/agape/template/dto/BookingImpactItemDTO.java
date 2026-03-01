package hr.agape.template.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingImpactItemDTO {
    private Long itemId;
    private String itemCode;
    private String name;
    private String unit;

    // Which fields actually changed
    private List<String> changedFields;

    // Only populated when changed
    private BigDecimal beforeCurrentQty;
    private BigDecimal deltaCurrentQty;
    private BigDecimal afterCurrentQty;

    private BigDecimal beforePendingOutQty;
    private BigDecimal deltaPendingOutQty;
    private BigDecimal afterPendingOutQty;

    private BigDecimal beforePendingInQty;
    private BigDecimal deltaPendingInQty;
    private BigDecimal afterPendingInQty;

    private BigDecimal beforeInQty;
    private BigDecimal deltaInQty;
    private BigDecimal afterInQty;

    private BigDecimal beforeOutQty;
    private BigDecimal deltaOutQty;
    private BigDecimal afterOutQty;

    private BigDecimal beforeEffectiveQty;
    private BigDecimal afterEffectiveQty;

    private boolean missingInWarehouse;
}
