package hr.agape.dispatch.scan.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class DispatchSlipParsedLineDTO {

    private Long documentId;
    private String slipItemCode;
    private String source;

    private Long itemId;

    private String itemCode;
    private String itemName;
    private String unit;

    private BigDecimal quantity;

    private Boolean itemResolved;
    private Boolean quantityValid;
    private Boolean requiresManualItem;
    private Boolean requiresManualQuantity;
    private Boolean valid;
    private String warning;
}
