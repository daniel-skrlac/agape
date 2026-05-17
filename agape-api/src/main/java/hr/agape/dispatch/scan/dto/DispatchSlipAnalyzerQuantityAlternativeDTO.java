package hr.agape.dispatch.scan.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class DispatchSlipAnalyzerQuantityAlternativeDTO {

    private BigDecimal quantity;
    private BigDecimal confidence;
    private String source;
    private String raw;
}
