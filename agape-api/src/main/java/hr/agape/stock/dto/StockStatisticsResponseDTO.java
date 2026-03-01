package hr.agape.stock.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class StockStatisticsResponseDTO {

    private StockStatisticsTotalsDTO totals;

    private List<StockItemSummaryDTO> missing;
    private List<StockItemSummaryDTO> needsFill;
    private List<StockItemSummaryDTO> mostInStock;
}
