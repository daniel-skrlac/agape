package hr.agape.stock.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class StockStatisticsResponseDTO {

    private StockStatisticsTotalsDTO totals;

    private Integer selectedYear;
    private Long selectedWarehouseId;
    private Long selectedStorageGroupId;
    private String documentCode;
    private List<Integer> availableYears;

    private List<StockItemSummaryDTO> missing;
    private List<StockItemSummaryDTO> needsFill;
    private List<StockItemSummaryDTO> mostInStock;
}
