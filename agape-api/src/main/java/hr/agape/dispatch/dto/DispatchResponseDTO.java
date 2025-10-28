package hr.agape.dispatch.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Response payload returned after successfully booking a single dispatch note
 * (OTPREMNICA/IZDATNICA) into the legacy Oracle schema.
 *
 * <p>This mirrors key fields persisted in {@code SD_GLAVA} so the client
 * can reference/print the document and correlate with the paper trail.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchResponseDTO {

    /**
     * Technical primary key of the document in {@code SD_GLAVA}.
     * <p>Assigned by the database via {@code SD_GLAVA_SEQ} in the trigger
     * {@code SD_GLAVA_BIU}.</p>
     */
    private Long documentHeaderId;

    /**
     * Logical document slot that was used for booking (warehouse-specific).
     * <p>Maps to {@code SD_GLAVA.DOKUMENT_ID}. This ties the document to a
     * type/ruleset via {@code SD_SIFREG -> SD_SIFREZ} and defines the numbering
     * scope for {@code DOKUMENTBR}.</p>
     */
    private Long documentId;

    /**
     * Human-readable internal document number within the selected slot.
     * <p>Maps to {@code SD_GLAVA.DOKUMENTBR}. Auto-incremented per
     * {@code DOKUMENT_ID} by trigger {@code SD_GLAVA_BIU}.</p>
     */
    private Long documentBr;

    /**
     * Final business date persisted for the document.
     * <p>Maps to {@code SD_GLAVA.DATUM_DOKUMENTA}. If the client didn’t send it,
     * the trigger populated it.</p>
     */
    private LocalDate documentDate;

    /**
     * Recipient/partner for whom goods were dispatched.
     * <p>Maps to {@code SD_GLAVA.PARTNER_ID} (FK to {@code PARTNERI}).</p>
     */
    private Long partnerId;

    /**
     * Processing outcome for client UX/logging (not stored in legacy tables).
     * <p>Typical values: {@code "BOOKED"} (success), {@code "PARTIAL"} (if you
     * later support mixed outcomes), or {@code "FAILED"} (for error handling).
     * In this simple flow it will be {@code "BOOKED"} on success.</p>
     */
    private String status;

    private Boolean posted;
    private Long postedBy;
    private OffsetDateTime postedAt;

    private Boolean cancelled;
    private Long cancelledBy;
    private OffsetDateTime cancelledAt;
    private String cancelNote;

    // SD_GLAVA.DATUM_IZRADE (actual persisted timestamp with time)
    private OffsetDateTime createdAt;
}
