package hr.agape.dispatch.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchBookingListItemDTO {
    private Long headerId;          // SD_GLAVA.ID
    private Long documentId;        // SD_GLAVA.DOKUMENT_ID
    private String documentCode;    // SD_SIFREZ.DOKUMENTID
    private String documentName;    // SD_SIFREZ.NAZIVDOKUMENTA
    private Long documentBr;        // SD_GLAVA.DOKUMENTBR

    private Long partnerId;         // SD_GLAVA.PARTNER_ID
    private String partnerName;     // PARTNERI.NAZIV

    private OffsetDateTime bookedAt; // COALESCE(DATUM_KNJIZENJA, DATUM_IZRADE)
    private boolean posted;          // KNJIZENO == 1
    private boolean cancelled;       // STORNO == 1
}
