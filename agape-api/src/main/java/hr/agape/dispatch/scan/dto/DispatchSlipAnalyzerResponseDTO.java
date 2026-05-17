package hr.agape.dispatch.scan.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class DispatchSlipAnalyzerResponseDTO {

    private Integer partnerNumber;
    private BigDecimal partnerNumberConfidence;

    private String partnerText;
    private BigDecimal partnerTextConfidence;

    private LocalDate documentDate;
    private BigDecimal documentDateConfidence;

    private Map<String, BigDecimal> quantities = new LinkedHashMap<>();
    private Map<String, BigDecimal> quantityConfidences = new LinkedHashMap<>();

    private List<DispatchSlipAnalyzerQuantityDTO> quantityResults;
    private List<DispatchSlipAnalyzerPartnerCandidateDTO> partnerCandidates;
    private List<DispatchSlipAnalyzerDateCandidateDTO> dateCandidates;

    private String rawText;
    private List<String> warnings;
    private Long processingMs;
    private DispatchSlipAnalyzerImageQualityDTO imageQuality;
}
