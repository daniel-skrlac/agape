package hr.agape.dispatch.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DispatchBulkValidationItemDTO {

    @NotNull
    private Long partnerId;

    @Valid
    @NotNull
    private DispatchRequestValidationDTO request;
}
