package hr.agape.dispatch.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchBookingDetailDTO {
    private Long headerId;
    private Long warehouseId;
    private Long documentId;
    private String documentCode;
    private String documentName;
    private Long documentBr;

    private OffsetDateTime documentDate; // SD_GLAVA.DATUM_DOKUMENTA
    private OffsetDateTime bookedAt;     // COALESCE(DATUM_KNJIZENJA, DATUM_IZRADE)

    private Long partnerId;
    private String partnerName;

    private boolean posted;      // KNJIZENO == 1
    private boolean cancelled;   // STORNO == 1

    private Long createdBy;      // IZRADIO
    private OffsetDateTime createdAt; // DATUM_IZRADE

    private Long postedBy;       // KNJIZIO
    private OffsetDateTime postedAt;  // DATUM_KNJIZENJA

    private Long cancelledBy;    // STORNIRAO
    private OffsetDateTime cancelledAt; // DATUM_STORNO

    private List<DispatchBookingItemDTO> items;
}
