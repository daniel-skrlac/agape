package hr.agape.dispatch.scan.dto;

import hr.agape.template.enumeration.DraftMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class BookingSessionScanEntryUpsertRequestDTO {

    @NotNull(message = "Partner is required.")
    private Long partnerId;

    private Long templateId;
    private DraftMode draftMode;
    private LocalDate documentDate;
    private String note;

    @Valid
    @NotEmpty(message = "At least one line is required.")
    private List<BookingSessionScanLineDTO> lines;
}
