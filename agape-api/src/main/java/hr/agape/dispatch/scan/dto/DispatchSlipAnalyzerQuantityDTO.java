package hr.agape.dispatch.scan.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
public class DispatchSlipAnalyzerQuantityDTO {

    private String slipItemCode;
    private BigDecimal quantity;
    private BigDecimal confidence;
    private String raw;
    private String source;
    private String layoutSource;
    private BigDecimal cropConfidence;
    private List<DispatchSlipAnalyzerQuantityAlternativeDTO> alternatives;
}
