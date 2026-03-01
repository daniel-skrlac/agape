package hr.agape.dispatch.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchSummaryResponseDTO {
    private Long id;                 // SD_GLAVA.ID
    private Long documentId;         // SD_GLAVA.DOKUMENT_ID
    private Long documentNumber;     // SD_GLAVA.DOKUMENTBR
    private LocalDate documentDate;  // SD_GLAVA.DATUM_DOKUMENTA

    private Long partnerId;          // SD_GLAVA.PARTNER_ID

    private Long createdBy;          // SD_GLAVA.IZRADIO
    private OffsetDateTime createdAt;// SD_GLAVA.DATUM_IZRADE

    private Boolean posted;          // SD_GLAVA.KNJIZENO == 1
    private Long postedBy;           // SD_GLAVA.KNJIZIO
    private OffsetDateTime postedAt; // SD_GLAVA.DATUM_KNJIZENJA

    private Boolean cancelled;       // STORNIRAO != null
    private Long cancelledBy;        // STORNIRAO
    private OffsetDateTime cancelledAt; // DATUM_STORNO

    private String status;           // DRAFT / POSTED / CANCELLED
}