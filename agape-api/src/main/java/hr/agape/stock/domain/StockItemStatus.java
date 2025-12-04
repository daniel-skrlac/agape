package hr.agape.stock.domain;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class StockItemStatus {

    private Long itemId;
    private Long warehouseId;

    private String itemCode;
    private String name;
    private String unit;

    private BigDecimal currentQty;
    private BigDecimal minimalQty;
    private BigDecimal recommendedQty;
    private BigDecimal reservedQty;
}
