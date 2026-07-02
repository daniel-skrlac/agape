package hr.agape.document.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Public API response describing one logical document slot (SD_SIFREG)
 * and its resolved type info (SD_SIFREZ).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentDescriptorResponseDTO {
    private Long documentId;    // SD_SIFREG.DOKUMENT_ID
    private Long warehouseId;   // SD_SIFREG.SKLADISTE_ID
    private Long storageGroupId; // SD_SIFREZ.SKL_SIFREZ_ID
    private String storageGroupName; // SKL_SIFREZ.OPIS
    private String documentCode;  // SD_SIFREZ.DOKUMENTID (e.g. OTPREMNICA)
    private String displayName;   // SD_SIFREZ.NAZIVDOKUMENTA (e.g. IZDATNICA)
    private Long inOutFlag;     // SD_SIFREZ.ULAZIZLAZ (1=IN,4=OUT,…)
    private Long changesStock;  // SD_SIFREZ.MIJENJAZALIHU (1=yes,0=no)
    private Boolean scanSupported; // true when this document slot can be used by the dispatch scanner
}
