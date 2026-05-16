package hr.agape.dispatch.scan.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class DispatchSlipParsedDTO {

    private Long scanId;
    private Long bookingSessionId;
    private Long partnerId;
    private String partnerName;
    private Long templateId;
    private Long warehouseId;
    private LocalDate documentDate;

    @Valid
    @NotEmpty(message = "At least one scan line is required.")
    private List<DispatchSlipParsedLineDTO> lines;

    private String note;
}
