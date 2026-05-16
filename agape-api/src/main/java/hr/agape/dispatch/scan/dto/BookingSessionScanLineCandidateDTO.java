package hr.agape.dispatch.scan.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class BookingSessionScanLineCandidateDTO {

    private Long documentId;
    private String slipItemCode;

    private Long itemId;
    private String itemCode;
    private String itemName;
    private String unit;

    private BigDecimal quantity;
}
