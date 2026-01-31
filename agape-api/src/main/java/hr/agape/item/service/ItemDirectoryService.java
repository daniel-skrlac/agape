package hr.agape.item.service;

import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.item.dto.ItemDescriptorResponseDTO;
import hr.agape.item.mapper.ItemDirectoryMapper;
import hr.agape.item.repository.ItemDirectoryRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.List;

@ApplicationScoped
public class ItemDirectoryService {

    private final ItemDirectoryRepository repo;
    private final ItemDirectoryMapper mapper;

    @Inject
    public ItemDirectoryService(ItemDirectoryRepository repo, ItemDirectoryMapper mapper) {
        this.repo = repo;
        this.mapper = mapper;
    }

    @Transactional
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

            String qq = (q == null) ? null : q.trim();

            long total = repo.countItems(warehouseId, qq);

            var views = repo.pageItems(warehouseId, offset, safeSize, qq);

            List<ItemDescriptorResponseDTO> items = views.stream()
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
