package hr.agape.document.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Price/tax snapshot from SKL_ACIJENE.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentItemPriceEntity {
    private Long itemId;
    private Long pdvId;

    private BigDecimal priceFak;
    private BigDecimal priceNab;
    private BigDecimal priceMp;
    private BigDecimal priceJedinice;
}
