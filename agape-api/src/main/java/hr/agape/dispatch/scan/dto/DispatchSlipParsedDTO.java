package hr.agape.dispatch.scan.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class DispatchSlipParsedDTO {

    private Long bookingSessionId;
    private Long partnerId;
    private String partnerName;
    private Long templateId;
    private Long documentId;
    private Long warehouseId;

    private LocalDate documentDate;
    private BigDecimal documentDateConfidence;

    private String rawText;
    private String detectedPartnerText;
    private BigDecimal partnerConfidence;

    private Boolean partnerResolved;
    private Boolean requiresManualPartner;
    private Boolean allValid;
    private List<String> warnings;

    private Long processingMs;
    private DispatchSlipAnalyzerImageQualityDTO imageQuality;

    @Valid
    @NotEmpty(message = "At least one scan line is required.")
    private List<DispatchSlipParsedLineDTO> lines;

    private String note;
}
