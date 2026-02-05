package hr.agape.document.service;

import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.document.dto.DocumentDescriptorResponseDTO;
import hr.agape.document.lookup.view.DocumentSlotTypeView;
import hr.agape.document.mapper.DocumentDirectoryMapper;
import hr.agape.document.repository.DocumentTypeRepository;
import hr.agape.document.warehouse.dto.WarehouseDTO;
import hr.agape.document.warehouse.repository.WarehouseRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.TransactionSynchronizationRegistry;
import jakarta.transaction.Transactional;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class DocumentDirectoryService {

    private final DocumentTypeRepository docTypeRepo;
    private final WarehouseRepository warehouseRepo;
    private final DocumentDirectoryMapper mapper;
    private final TransactionSynchronizationRegistry tsr;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public DocumentDirectoryService(
            DocumentTypeRepository docTypeRepo,
            WarehouseRepository warehouseRepo,
            DocumentDirectoryMapper mapper,
            TransactionSynchronizationRegistry tsr
    ) {
        this.docTypeRepo = docTypeRepo;
        this.warehouseRepo = warehouseRepo;
        this.mapper = mapper;
        this.tsr = tsr;
    }

    @Transactional
    public ServiceResponseDTO<DocumentDescriptorResponseDTO> getDocumentDescriptor(Long documentId) {
        try {
            return docTypeRepo.findDocumentSlot(documentId)
                    .map(slotView ->
                            ServiceResponseDirector.successOk(
                                    mapper.toResponseDto(slotView),
                                    "OK"
                            )
                    )
                    .orElseGet(() ->
                            ServiceResponseDirector.errorNotFound(
                                    "documentId " + documentId + " not found in SD_SIFREG/SD_SIFREZ"
                            )
                    );
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal(
                    "Failed to load documentId " + documentId + ": " + e.getMessage()
            );
        }
    }

    @Transactional
    public ServiceResponseDTO<PagedResultDTO<DocumentDescriptorResponseDTO>> pageDocumentDescriptors(int page, int size, String q) {
        try {
            int p = Math.max(0, page);
            int s = Math.max(1, size);
            int offset = p * s;

            String qq = (q == null) ? null : q.trim();
            boolean hasQ = (qq != null && !qq.isBlank());

            long total = hasQ
                    ? docTypeRepo.countDistinctDocumentIdsFiltered(qq)
                    : docTypeRepo.countDistinctDocumentIds();

            List<DocumentSlotTypeView> slotViews = hasQ
                    ? docTypeRepo.pageDocumentSlotsFiltered(offset, s, qq)
                    : docTypeRepo.pageDocumentSlots(offset, s);

            List<DocumentDescriptorResponseDTO> dtoList = slotViews.stream()
                    .map(mapper::toResponseDto)
                    .collect(Collectors.toList());

            PagedResultDTO<DocumentDescriptorResponseDTO> pageResult =
                    PagedResultDTO.<DocumentDescriptorResponseDTO>builder()
                            .items(dtoList)
                            .page(p)
                            .size(s)
                            .total(total)
                            .build();

            return ServiceResponseDirector.successOk(pageResult, "OK");
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal(
                    "Failed to load document types: " + e.getMessage()
            );
        }
    }

    @Transactional
    public ServiceResponseDTO<List<DocumentDescriptorResponseDTO>> listDocumentDescriptors(
            Long warehouseId,
            String documentCode,
            String q,
            String excludeCodes,
            String excludeDocumentIds // ✅ NEW
    ) {
        try {
            String qq = (q == null) ? null : q.trim();
            String code = (documentCode == null) ? null : documentCode.trim();

            List<String> excludes = splitCsvUpper(excludeCodes);
            Set<Long> excludeIds = splitCsvLongSet(excludeDocumentIds);

            if (code != null && !code.isBlank()) {
                String codeU = code.trim().toUpperCase();

                if (excludes.contains(codeU)) {
                    return ServiceResponseDirector.successOk(List.of(), "OK");
                }

                return docTypeRepo.findDocumentSlotByCodeAndWarehouse(warehouseId, codeU)
                        .filter(v -> !excludeIds.contains((long) v.getDocumentId())) // ✅ exclude by docId
                        .map(v -> ServiceResponseDirector.successOk(List.of(mapper.toResponseDto(v)), "OK"))
                        .orElseGet(() -> ServiceResponseDirector.successOk(List.of(), "OK"));
            }

            List<DocumentSlotTypeView> slotViews = docTypeRepo.listDocumentSlots(warehouseId, qq, excludes, excludeIds);

            List<DocumentDescriptorResponseDTO> dtoList = slotViews.stream()
                    .map(mapper::toResponseDto)
                    .toList();

            return ServiceResponseDirector.successOk(dtoList, "OK");
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal("Failed to load document types: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponseDTO<List<WarehouseDTO>> listWarehousesForDocument(int documentId) {
        try {
            List<WarehouseDTO> items = warehouseRepo.listWarehousesForDocument(documentId);

            if (items == null || items.isEmpty()) {
                return ServiceResponseDirector.errorNotFound("No warehouses found for documentId " + documentId);
            }

            return ServiceResponseDirector.successOk(items, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to load warehouses: " + e.getMessage());
        }
    }
    private static List<String> splitCsvUpper(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(String::toUpperCase)
                .distinct()
                .toList();
    }

    private static Set<Long> splitCsvLongSet(String csv) {
        if (csv == null || csv.isBlank()) return Set.of();
        Set<Long> out = new HashSet<>();
        for (String part : csv.split(",")) {
            String s = part.trim();
            if (s.isBlank()) continue;
            try {
                out.add(Long.parseLong(s));
            } catch (NumberFormatException ignored) {
            }
        }
        return out;
    }
}
