package hr.agape.item.service;

import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.item.dto.ItemDescriptorResponseDTO;
import hr.agape.item.mapper.ItemDirectoryMapper;
import hr.agape.item.repository.ItemDirectoryRepository;
import hr.agape.item.util.ItemCodeUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@ApplicationScoped
public class ItemDirectoryService {

    private final ItemDirectoryRepository repo;
    private final ItemDirectoryMapper mapper;

    @Inject
    public ItemDirectoryService(ItemDirectoryRepository repo, ItemDirectoryMapper mapper) {
        this.repo = repo;
        this.mapper = mapper;
    }

    public Map<Long, ItemDescriptorResponseDTO> findItemsByIds(List<Long> itemIds) {
        try {
            if (itemIds == null || itemIds.isEmpty()) {
                return Map.of();
            }

            List<Long> ids = itemIds.stream()
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();

            if (ids.isEmpty()) {
                return Map.of();
            }

            return repo.findItemsByIds(ids).stream()
                    .map(mapper::toDto)
                    .filter(item -> item.getItemId() != null)
                    .collect(Collectors.toMap(
                            ItemDescriptorResponseDTO::getItemId,
                            item -> item,
                            (first, second) -> first,
                            LinkedHashMap::new
                    ));
        } catch (Exception e) {
            return Map.of();
        }
    }

    public Map<String, ItemDescriptorResponseDTO> findItemsByCodes(Long warehouseId, List<String> codes) {
        try {
            if (warehouseId == null) {
                return Map.of();
            }

            List<String> requestedCodes = ItemCodeUtil.cleanCodes(codes);
            if (requestedCodes.isEmpty()) {
                return Map.of();
            }

            List<String> numericCodes = ItemCodeUtil.numericCodes(requestedCodes);
            List<String> paddedNumericCodes = ItemCodeUtil.paddedNumericCodes(requestedCodes);

            Map<String, ItemDescriptorResponseDTO> aliases = new LinkedHashMap<>();

            repo.findItemsByCodes(warehouseId, requestedCodes, numericCodes, paddedNumericCodes).stream()
                    .map(mapper::toDto)
                    .forEach(item -> ItemCodeUtil.aliasesFor(item.getCode(), item.getItemId())
                            .forEach(alias -> aliases.putIfAbsent(alias, item)));

            Map<String, ItemDescriptorResponseDTO> out = new LinkedHashMap<>();

            for (String requestedCode : requestedCodes) {
                String key = ItemCodeUtil.normalize(requestedCode);
                ItemDescriptorResponseDTO item = aliases.get(key);

                if (item != null) {
                    out.put(key, item);
                }
            }

            return out;
        } catch (Exception e) {
            return Map.of();
        }
    }

    public ServiceResponseDTO<PagedResultDTO<ItemDescriptorResponseDTO>> pageItems(
            Long warehouseId,
            int page,
            int size,
            String q
    ) {
        try {
            if (warehouseId == null) {
                return ServiceResponseDirector.errorBadRequest("warehouseId is required.");
            }

            int safePage = Math.max(0, page);
            int safeSize = Math.min(100, Math.max(1, size));
            int offset = safePage * safeSize;

            String qq = q == null ? null : q.trim();

            long total = repo.countItems(warehouseId, qq);

            List<ItemDescriptorResponseDTO> items = repo.pageItems(warehouseId, offset, safeSize, qq).stream()
                    .map(mapper::toDto)
                    .toList();

            PagedResultDTO<ItemDescriptorResponseDTO> out = PagedResultDTO.<ItemDescriptorResponseDTO>builder()
                    .items(items)
                    .page(safePage)
                    .size(safeSize)
                    .total(total)
                    .build();

            return ServiceResponseDirector.successOk(out, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to search items: " + e.getMessage());
        }
    }
}