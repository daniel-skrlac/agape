package hr.agape.dispatch.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Builder
public class DispatchBulkValidationResponseDTO {
    private List<DispatchBulkValidationRowDTO> results;
}
