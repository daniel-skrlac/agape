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

import java.util.List;
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
    public ServiceResponseDTO<DocumentDescriptorResponseDTO> getDocumentDescriptor(int documentId) {
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
    public ServiceResponseDTO<PagedResultDTO<WarehouseDTO>> pageWarehousesForDocument(int documentId, int page, int size) {
        try {
            int p = Math.max(0, page);
            int s = Math.max(1, size);
            int offset = p * s;

            long total = warehouseRepo.countWarehousesForDocument(documentId);
            if (total == 0) {
                return ServiceResponseDirector.errorNotFound(
                        "No warehouses found for documentId " + documentId
                );
            }

            List<WarehouseDTO> items = warehouseRepo.pageWarehousesForDocument(documentId, offset, s);

            PagedResultDTO<WarehouseDTO> result =
                    PagedResultDTO.<WarehouseDTO>builder()
                            .items(items)
                            .page(p)
                            .size(s)
                            .total(total)
                            .build();

            return ServiceResponseDirector.successOk(result, "OK");
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal(
                    "Failed to load warehouses: " + e.getMessage()
            );
        }
    }
}
