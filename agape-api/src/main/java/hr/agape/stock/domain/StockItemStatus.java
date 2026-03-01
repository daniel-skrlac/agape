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

    // SKL_APROMETI
    private BigDecimal currentQty;     // ZALIHATRENUTNA
    private BigDecimal pendingOutQty;  // ZALIHANEPROKNJIZENA
    private BigDecimal pendingInQty;   // ZALIHAKALKULACIJA

    // SKL_APROMETI counters (what you selected)
    private BigDecimal inQty;          // INPKOLICINA
    private BigDecimal outQty;         // OUTKOLICINA

    // optional (if you use them elsewhere)
    private BigDecimal reservedQty;
    private BigDecimal minimalQty;
    private BigDecimal recommendedQty;
}
