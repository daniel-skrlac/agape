package hr.agape.stock.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class StockStatisticsTotalsDTO {

    private Long totalItems;        // how many active items exist
    private Long missingCount;      // items with qty ≤ 0
    private Long needsFillCount;    // items with qty < minimal but > 0
    private Long overstockedCount;  // qty > recommended
    private Long reservedCount;     // reserved qty > 0

    private BigDecimal totalStockQty; // sum of all quantities
}
