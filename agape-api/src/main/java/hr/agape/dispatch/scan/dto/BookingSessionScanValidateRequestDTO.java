package hr.agape.dispatch.scan.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class BookingSessionScanValidateRequestDTO {

    private Long partnerId;

    private Long templateId;
    private LocalDate documentDate;
    private String note;

    @Valid
    @NotEmpty(message = "At least one line is required.")
    private List<BookingSessionScanLineCandidateDTO> lines;
}
