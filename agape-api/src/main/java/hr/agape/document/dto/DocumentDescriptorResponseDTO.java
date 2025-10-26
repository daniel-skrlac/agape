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
    private Integer documentId;     // SD_SIFREG.DOKUMENT_ID
    private String  documentCode;   // SD_SIFREZ.DOKUMENTID (e.g. OTPREMNICA)
    private String  displayName;    // SD_SIFREZ.NAZIVDOKUMENTA (e.g. IZDATNICA)
    private Integer inOutFlag;      // SD_SIFREZ.ULAZIZLAZ (1=IN,4=OUT,…)
    private Integer changesStock;   // SD_SIFREZ.MIJENJAZALIHU (1=yes,0=no)
}
