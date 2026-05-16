package hr.agape.dispatch.scan.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class BookingSessionScanValidateResponseDTO {

    private Long sessionId;
    private Long partnerId;
    private String partnerName;
    private Long templateId;
    private LocalDate documentDate;
    private Boolean partnerResolved;
    private Boolean requiresManualPartner;

    private Boolean allValid;

    private List<BookingSessionScanLineValidationDTO> lines;
}
