package hr.agape.dispatch.scan.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class DispatchSlipAnalyzerPartnerCandidateDTO {

    private Integer number;
    private String text;
    private BigDecimal confidence;
    private String source;
}
