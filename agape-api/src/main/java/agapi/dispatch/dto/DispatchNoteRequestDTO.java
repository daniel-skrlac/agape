package agapi.dispatch.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * Request payload to book a single dispatch note (OTPREMNICA/IZDATNICA) into the legacy Oracle schema.
 * Minimal input: documentId, partnerId, and at least one line (itemId + quantity).
 * Everything else (IDs, numbering, derived fields) is handled by Oracle sequences & triggers.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchNoteRequestDTO {

    /**
     * Logical document slot used by the warehouse, e.g. 3, 9, 23, 32.
     * Maps to SD_GLAVA.DOKUMENT_ID (via SD_SIFREG → SD_SIFREZ decides “outgoing stock” rules).
     */
    @NotNull
    private Integer documentId;

    /**
     * Business date of the document (optional).
     * If omitted, SD_GLAVA_BIU trigger assigns/normalizes it.
     */
    private LocalDate documentDate;

    /**
     * Recipient/partner for whom goods are dispatched (FK → PARTNERI.PARTNER_ID).
     */
    @NotNull
    private Integer partnerId;

    /**
     * Human-facing dispatch number printed on paper (optional).
     * Not the same as DOKUMENTBR (internal sequence).
     */
    private String dispatchNumber;

    /**
     * Lines to book on this document. At least one is required.
     * Each item needs itemId (ARTIKL_ID) and quantity (KOLICINA).
     */
    @NotNull
    @Size(min = 1)
    private List<DispatchItemRequest> items;

    /**
     * One line on the dispatch note.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DispatchItemRequest {
        /**
         * Item/article to dispatch. Maps to SD_STAVKE.ARTIKL_ID.
         */
        @NotNull
        private Integer itemId;

        /**
         * Quantity to dispatch. Maps to SD_STAVKE.KOLICINA.
         */
        @NotNull
        @DecimalMin(value = "0.0", inclusive = false, message = "quantity must be > 0")
        private Double quantity;
    }
}
