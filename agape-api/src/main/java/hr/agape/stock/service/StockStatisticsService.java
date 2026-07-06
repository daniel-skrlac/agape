package hr.agape.stock.service;

import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.stock.domain.StockItemStatus;
import hr.agape.stock.dto.StockItemSummaryDTO;
import hr.agape.stock.dto.StockStatisticsResponseDTO;
import hr.agape.stock.dto.StockStatisticsTotalsDTO;
import hr.agape.stock.mapper.StockItemMapper;
import hr.agape.stock.mapper.StockTotalsMapper;
import hr.agape.stock.repository.StockStatisticsRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

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
            Long effectiveWarehouseId = positiveOrNull(warehouseId);
            Long effectiveStorageGroupId = positiveOrNull(storageGroupId);
            String code = documentCode == null || documentCode.isBlank()
                    ? "OTPREMNICA"
                    : documentCode.trim().toUpperCase();

            List<StockItemStatus> items = repo.findAllEligible(effectiveWarehouseId, effectiveStorageGroupId, documentYear, code);

            StockStatisticsTotalsDTO totals = calculateTotals(items);
            StockStatisticsTotalsDTO totalsDto = totalsMapper.toDto(totals);

            List<StockItemSummaryDTO> missing =
                    items.stream()
                            .filter(StockStatisticsService::isMissing)
                            .sorted(byNameThenCode())
                            .map(itemMapper::toDto).toList();

            List<StockItemSummaryDTO> needsFill =
                    items.stream()
                            .filter(StockStatisticsService::needsFill)
                            .sorted(Comparator
                                    .comparing(StockStatisticsService::fillRatio, Comparator.nullsFirst(BigDecimal::compareTo))
                                    .thenComparing(byNameThenCode()))
                            .map(itemMapper::toDto).toList();

            List<StockItemSummaryDTO> most =
                    items.stream()
                            .filter(item -> isPositive(item.getCurrentQty()))
                            .sorted(Comparator
                                    .comparing(StockItemStatus::getCurrentQty, Comparator.nullsLast(BigDecimal::compareTo))
                                    .reversed()
                                    .thenComparing(byNameThenCode()))
                            .map(itemMapper::toDto).toList();

            List<Integer> availableYears = repo.listAvailableYears(code, effectiveWarehouseId, effectiveStorageGroupId);

            StockStatisticsResponseDTO dto = StockStatisticsResponseDTO.builder()
                    .totals(totalsDto)
                    .selectedYear(documentYear)
                    .selectedWarehouseId(effectiveWarehouseId)
                    .selectedStorageGroupId(effectiveStorageGroupId)
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

    private static Long positiveOrNull(Long value) {
        return value == null || value <= 0 ? null : value;
    }

    private static StockStatisticsTotalsDTO calculateTotals(List<StockItemStatus> items) {
        long totalItems = items.size();
        long missingCount = items.stream().filter(StockStatisticsService::isMissing).count();
        long needsFillCount = items.stream().filter(StockStatisticsService::needsFill).count();
        long overstockedCount = items.stream()
                .filter(item -> item.getRecommendedQty() != null)
                .filter(item -> compare(item.getCurrentQty(), item.getRecommendedQty()) > 0)
                .count();
        long reservedCount = items.stream()
                .filter(item -> isPositive(item.getReservedQty()))
                .count();
        BigDecimal totalStockQty = items.stream()
                .map(StockItemStatus::getCurrentQty)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return StockStatisticsTotalsDTO.builder()
                .totalItems(totalItems)
                .missingCount(missingCount)
                .needsFillCount(needsFillCount)
                .overstockedCount(overstockedCount)
                .reservedCount(reservedCount)
                .totalStockQty(totalStockQty)
                .build();
    }

    private static boolean isMissing(StockItemStatus item) {
        return item.getCurrentQty() == null || item.getCurrentQty().compareTo(BigDecimal.ZERO) <= 0;
    }

    private static boolean needsFill(StockItemStatus item) {
        return isPositive(item.getCurrentQty())
                && isPositive(item.getMinimalQty())
                && item.getCurrentQty().compareTo(item.getMinimalQty()) < 0;
    }

    private static boolean isPositive(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) > 0;
    }

    private static int compare(BigDecimal left, BigDecimal right) {
        BigDecimal l = left == null ? BigDecimal.ZERO : left;
        BigDecimal r = right == null ? BigDecimal.ZERO : right;
        return l.compareTo(r);
    }

    private static BigDecimal fillRatio(StockItemStatus item) {
        if (!isPositive(item.getCurrentQty()) || !isPositive(item.getMinimalQty())) return null;
        return item.getCurrentQty().divide(item.getMinimalQty(), 6, java.math.RoundingMode.HALF_UP);
    }

    private static Comparator<StockItemStatus> byNameThenCode() {
        return Comparator
                .comparing((StockItemStatus item) -> nullToLast(item.getName()), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(item -> nullToLast(item.getItemCode()), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(item -> item.getItemId() == null ? Long.MAX_VALUE : item.getItemId());
    }

    private static String nullToLast(String value) {
        return value == null || value.isBlank() ? "\uFFFF" : value;
    }
}
