package hr.agape.dispatch.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Result of processing ONE request in a bulk booking call.
 * - success=true => response is present
 * - success=false => error is present (and headerId may be present if draft was created before failure)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchBulkItemResultDTO {

    /**
     * Index of the request in the original input list
     */
    private int index;

    private Long documentId;
    private Long partnerId;

    /**
     * what client requested
     */
    private Boolean requestedDraft;

    /**
     * headerId if we managed to create SD_GLAVA (draft)
     */
    private Long headerId;

    /**
     * POSTED / DRAFT / FAILED
     */
    private String status;

    private Boolean success;

    /**
     * Human-friendly failure reason
     */
    private String error;

    /**
     * Full response for success (or for draft created)
     */
    private DispatchResponseDTO response;
}
