package agapi.document.ref.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * SD_SIFREG — Mapping of warehouse to a concrete document slot (documentId),
 * pointing to a {@link DocumentType} definition.
 *
 * <p>Example from your DB:
 * - warehouseId=1 → documentId=3  → OTPREMNICA / IZDATNICA
 * - warehouseId=2 → documentId=9  → OTPREMNICA / IZDATNICA
 * - warehouseId=3 → documentId=23 → OTPREMNICA / IZDATNICA
 * - warehouseId=4 → documentId=32 → OTPREMNICA / IZDATNICA
 * </p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentSlotMapping {
    /**
     * SD_SIFREG.DOKUMENT_ID — numeric “document slot” used in SD_GLAVA/SD_STAVKE.
     */
    private Integer documentId;

    /**
     * SD_SIFREG.SKLADISTE_ID — warehouse using this slot.
     */
    private Integer warehouseId;

    /**
     * SD_SIFREG.SD_SIFREZ_ID — FK to SD_SIFREZ (document type).
     */
    private Integer documentTypeId;
}
