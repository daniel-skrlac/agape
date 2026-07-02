package hr.agape.stock.service;

import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.stock.dto.StockItemSummaryDTO;
import hr.agape.stock.dto.StockStatisticsResponseDTO;
import hr.agape.stock.dto.StockStatisticsTotalsDTO;
import hr.agape.stock.mapper.StockItemMapper;
import hr.agape.stock.mapper.StockTotalsMapper;
import hr.agape.stock.repository.StockStatisticsRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.List;

@ApplicationScoped
public class StockStatisticsService {

    private final StockStatisticsRepository repo;
    private final StockItemMapper itemMapper;
    private final StockTotalsMapper totalsMapper;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public StockStatisticsService(
            StockStatisticsRepository repo,
            StockItemMapper itemMapper,
            StockTotalsMapper totalsMapper) {

        this.repo = repo;
        this.itemMapper = itemMapper;
        this.totalsMapper = totalsMapper;
    }

    @Transactional(Transactional.TxType.NOT_SUPPORTED)
    public ServiceResponseDTO<StockStatisticsResponseDTO> getStatistics(
            Long warehouseId,
            Long storageGroupId,
            Integer documentYear,
            String documentCode
    ) {
        try {
            String code = documentCode == null || documentCode.isBlank()
                    ? "OTPREMNICA"
                    : documentCode.trim().toUpperCase();

            StockStatisticsTotalsDTO totals = repo.loadTotals(warehouseId, storageGroupId, documentYear, code);
            StockStatisticsTotalsDTO totalsDto = totalsMapper.toDto(totals);

            List<StockItemSummaryDTO> missing =
                    repo.findMissing(warehouseId, storageGroupId, documentYear, code)
                            .stream().map(itemMapper::toDto).toList();

            List<StockItemSummaryDTO> needsFill =
                    repo.findNeedsFill(warehouseId, storageGroupId, documentYear, code)
                            .stream().map(itemMapper::toDto).toList();

            List<StockItemSummaryDTO> most =
                    repo.findMostInStock(warehouseId, storageGroupId, documentYear, code)
                            .stream().map(itemMapper::toDto).toList();

            List<Integer> availableYears = repo.listAvailableYears(code, warehouseId, storageGroupId);

            StockStatisticsResponseDTO dto = StockStatisticsResponseDTO.builder()
                    .totals(totalsDto)
                    .selectedYear(documentYear)
                    .selectedWarehouseId(warehouseId)
                    .selectedStorageGroupId(storageGroupId)
                    .documentCode(code)
                    .availableYears(availableYears)
                    .missing(missing)
                    .needsFill(needsFill)
                    .mostInStock(most)
                    .build();

            return ServiceResponseDirector.successOk(dto, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to load stock statistics: " + e.getMessage());
        }
    }
}
