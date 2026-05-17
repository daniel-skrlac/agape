package hr.agape.dispatch.scan.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class DispatchSlipAnalyzerDateCandidateDTO {

    private LocalDate date;
    private BigDecimal confidence;
    private String source;
}
