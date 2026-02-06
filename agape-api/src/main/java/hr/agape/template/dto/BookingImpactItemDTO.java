package hr.agape.template.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingImpactItemDTO {
    private Long itemId;       // ARTIKL_ID (warehouse-specific)
    private String itemCode;   // SKL_ARTIKLIZ.ARTIKLID
    private String name;       // SKL_ANAZIVI.NAZIV
    private String unit;       // SIFRE_JMJ.JEDINICAMJERE

    // Snapshot
    private BigDecimal currentQty;     // SKL_APROMETI.ZALIHATRENUTNA
    private BigDecimal pendingOutQty;  // SKL_APROMETI.ZALIHANEPROKNJIZENA
    private BigDecimal pendingInQty;   // SKL_APROMETI.ZALIHAKALKULACIJA

    // Legacy effective availability (what KNJIZI_MK uses conceptually)
    // effective = current - pendingOut + pendingIn
    private BigDecimal effectiveQty;

    // Diff for THIS request
    private BigDecimal deltaPendingOutQty;
    private BigDecimal deltaPendingInQty;

    // After state
    private BigDecimal afterPendingOutQty;
    private BigDecimal afterPendingInQty;
    private BigDecimal afterEffectiveQty;

    private boolean missingInWarehouse;
}
