package hr.agape.dispatch.scan.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class DispatchSlipAnalyzerImageQualityDTO {

    private BigDecimal blurScore;
    private BigDecimal brightness;
    private BigDecimal contrast;
    private BigDecimal paperDetectionConfidence;
    private BigDecimal gridDetectionConfidence;
    private Integer detectedCellCount;
    private String gridSource;
}
