package hr.agape.dispatch.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Bulk response that supports partial success.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchBulkResponseDTO {

    private int total;
    private int succeeded;
    private int failed;

    private int posted;
    private int drafts;

    private List<DispatchBulkItemResultDTO> items;
}
