package hr.agape.dispatch.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class DispatchBulkValidationRequestDTO {

    @Valid
    @NotEmpty
    private List<DispatchBulkValidationItemDTO> items;
}
