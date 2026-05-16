package hr.agape.dispatch.scan.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class BookingSessionScanLineDTO {

    private Long documentId;
    private String slipItemCode;

    @NotNull(message = "Item is required.")
    private Long itemId;

    private String itemCode;
    private String itemName;
    private String unit;

    @NotNull(message = "Quantity is required.")
    @Positive(message = "Quantity must be greater than zero.")
    private BigDecimal quantity;
}
