package agapi.document.ref.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * SD_SIFREZ — Catalog of document types and their inventory behavior.
 *
 * <p>Examples:
 * - documentCode = "OTPREMNICA"
 * - displayName  = "IZDATNICA"
 * - inOutFlag    = 4 (OUT)
 * - changesStock = 1 (yes)
 * </p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentType {
    /**
     * SD_SIFREZ.SD_SIFREZ_ID (PK).
     */
    private Integer id;

    /**
     * SD_SIFREZ.SKL_SIFREZ_ID — legacy grouping key.
     */
    private Integer storeTypeGroupId;

    /**
     * SD_SIFREZ.DOKUMENTID — logical code, e.g. "OTPREMNICA", "PRIMKA".
     */
    private String documentCode;

    /**
     * SD_SIFREZ.NAZIVDOKUMENTA — human-readable name, e.g. "IZDATNICA".
     */
    private String displayName;

    /**
     * SD_SIFREZ.ULAZIZLAZ — direction:
     * 1 = IN (incoming), 4 = OUT (outgoing).
     */
    private Integer inOutFlag;

    /**
     * SD_SIFREZ.MIJENJAZALIHU — whether it changes stock:
     * 1 = yes, 0 = no.
     */
    private Integer changesStock;
}
