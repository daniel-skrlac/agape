package hr.agape.document.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class DocumentItemPriceDTO {
    private Long itemId;
    private Long pdvId;

    private BigDecimal priceFak;
    private BigDecimal priceNab;
    private BigDecimal priceMp;
    private BigDecimal priceJedinice;
}
