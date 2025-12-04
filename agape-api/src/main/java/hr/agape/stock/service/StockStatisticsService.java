package hr.agape.stock.service;

import hr.agape.common.response.ServiceResponse;
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

    private static final int HOME_LIMIT = 10;

    private final StockStatisticsRepository repo;
    private final StockItemMapper itemMapper;
    private final StockTotalsMapper totalsMapper;

    @Inject
    public StockStatisticsService(
            StockStatisticsRepository repo,
            StockItemMapper itemMapper,
            StockTotalsMapper totalsMapper) {

        this.repo = repo;
        this.itemMapper = itemMapper;
        this.totalsMapper = totalsMapper;
    }

    @Transactional
    public ServiceResponse<StockStatisticsResponseDTO> getStatistics() {
        try {
            StockStatisticsTotalsDTO totals = repo.loadTotals();
            StockStatisticsTotalsDTO totalsDto = totalsMapper.toDto(totals);

            List<StockItemSummaryDTO> missing =
                    repo.findMissing(HOME_LIMIT).stream().map(itemMapper::toDto).toList();

            List<StockItemSummaryDTO> needsFill =
                    repo.findNeedsFill(HOME_LIMIT).stream().map(itemMapper::toDto).toList();

            List<StockItemSummaryDTO> most =
                    repo.findMostInStock(HOME_LIMIT).stream().map(itemMapper::toDto).toList();

            StockStatisticsResponseDTO dto = StockStatisticsResponseDTO.builder()
                    .totals(totalsDto)
                    .missing(missing)
                    .needsFill(needsFill)
                    .mostInStock(most)
                    .build();

            return ServiceResponseDirector.successOk(dto, "OK");

        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal(
                    "Failed to load stock statistics: " + e.getMessage()
            );
        }
    }
}
