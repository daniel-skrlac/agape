package hr.agape.dispatch.service;

import hr.agape.common.dto.PagedResult;
import hr.agape.common.response.ServiceResponse;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.dto.DispatchResponseDTO;
import hr.agape.dispatch.dto.DispatchSearchFilter;
import hr.agape.dispatch.dto.DispatchSummaryResponseDTO;
import hr.agape.dispatch.dto.DispatchUpdateRequestDTO;
import hr.agape.dispatch.mapper.DispatchApiMapper;
import hr.agape.document.domain.DocumentHeaderEntity;
import hr.agape.document.dto.DocumentItemLineDTO;
import hr.agape.document.lookup.repository.DocumentItemLookupRepository;
import hr.agape.document.lookup.repository.DocumentVatLookupRepository;
import hr.agape.document.lookup.view.DocumentItemAttributesView;
import hr.agape.document.repository.DocumentHeaderRepository;
import hr.agape.document.repository.DocumentItemRepository;
import hr.agape.document.repository.DocumentLineRepository;
import hr.agape.document.repository.DocumentSlotRepository;
import hr.agape.document.warehouse.repository.PartnerRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.TransactionSynchronizationRegistry;
import jakarta.transaction.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class DispatchBookingService {

    private static final String REQ_PREFIX = "Request[";
    private static final String PDV_MISSING_FOR_DOC = "No PDV_ID found for documentId=";

    private final DocumentSlotRepository slotRepo;
    private final DocumentVatLookupRepository vatLookupRepo;
    private final DocumentHeaderRepository headerRepo;
    private final DocumentLineRepository lineRepo;
    private final DispatchApiMapper mapper;
    private final PartnerRepository partnerRepo;
    private final DocumentItemRepository itemRepo;
    private final TransactionSynchronizationRegistry tsr;
    private final DocumentItemLookupRepository itemAttrsRepo;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public DispatchBookingService(
            DocumentSlotRepository slotRepo,
            DocumentVatLookupRepository vatLookupRepo,
            DocumentHeaderRepository headerRepo,
            DocumentLineRepository lineRepo,
            DispatchApiMapper mapper,
            PartnerRepository partnerRepo,
            DocumentItemRepository itemRepo,
            TransactionSynchronizationRegistry tsr,
            DocumentItemLookupRepository itemAttrsRepo
    ) {
        this.slotRepo = slotRepo;
        this.vatLookupRepo = vatLookupRepo;
        this.headerRepo = headerRepo;
        this.lineRepo = lineRepo;
        this.mapper = mapper;
        this.partnerRepo = partnerRepo;
        this.itemRepo = itemRepo;
        this.tsr = tsr;
        this.itemAttrsRepo = itemAttrsRepo;
    }

    @Transactional
    public ServiceResponse<DispatchResponseDTO> bookOne(DispatchRequestDTO req) {
        try {
            Long whId = slotRepo.warehouseForDocument(req.getDocumentId());
            String err = validateReferences(req, whId, 0);
            if (err != null) {
                return ServiceResponseDirector.errorBadRequest(err);
            }

            Long docId = req.getDocumentId();
            Long pdvId = resolveVat(docId, whId);
            if (pdvId == null) {
                return ServiceResponseDirector.errorBadRequest(
                        PDV_MISSING_FOR_DOC + docId + " in warehouse " + whId + "."
                );
            }

            Map<Long, DocumentItemAttributesView> attrsByItem =
                    itemAttrsRepo.findAttributes(
                            req.getItems().stream()
                                    .map(DispatchRequestDTO.DispatchItemRequest::getItemId)
                                    .collect(Collectors.toSet())
                    );

            err = validateItemAttrsPresent(req, attrsByItem, 0);
            if (err != null) {
                return ServiceResponseDirector.errorBadRequest(err);
            }

            DocumentHeaderEntity headerInput = mapper.toHeader(req);
            boolean postNow = !req.isDraft();
            DocumentHeaderEntity header = headerRepo.insert(headerInput, postNow);

            List<DocumentItemLineDTO> prepared = prepareLines(req, attrsByItem, pdvId);
            lineRepo.insert(header.getId(), prepared);

            DispatchResponseDTO out = mapper.toResponse(header);
            out.setStatus(Boolean.TRUE.equals(header.getPosted()) ? "POSTED" : "DRAFT");

            return ServiceResponseDirector.successOk(
                    out,
                    Boolean.TRUE.equals(header.getPosted())
                            ? "Dispatch note booked (POSTED)."
                            : "Dispatch note saved as DRAFT."
            );
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal(
                    "Failed to book dispatch note: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponse<List<DispatchResponseDTO>> bookBulk(List<DispatchRequestDTO> requests) {
        try {
            List<Long> derivedWhIds = new ArrayList<>(requests.size());
            for (int i = 0; i < requests.size(); i++) {
                DispatchRequestDTO r = requests.get(i);

                Long whId = slotRepo.warehouseForDocument(r.getDocumentId());
                derivedWhIds.add(whId);

                String err = validateReferences(r, whId, i);
                if (err != null) {
                    return ServiceResponseDirector.errorBadRequest(err);
                }
            }

            Map<String, Long> vatByKey = resolveVatForRequests(requests, derivedWhIds);

            Set<Long> allItemIds = requests.stream()
                    .flatMap(r -> r.getItems().stream())
                    .map(DispatchRequestDTO.DispatchItemRequest::getItemId)
                    .collect(Collectors.toSet());

            Map<Long, DocumentItemAttributesView> attrsByItem =
                    itemAttrsRepo.findAttributes(allItemIds);

            List<DocumentHeaderEntity> persistedHeaders = new ArrayList<>(requests.size());
            for (DispatchRequestDTO r : requests) {
                DocumentHeaderEntity hdrIn = mapper.toHeader(r);
                boolean postNow = !r.isDraft();
                DocumentHeaderEntity hdr = headerRepo.insert(hdrIn, postNow);
                persistedHeaders.add(hdr);
            }

            for (int i = 0; i < requests.size(); i++) {
                DispatchRequestDTO req = requests.get(i);
                DocumentHeaderEntity hdr = persistedHeaders.get(i);

                Long docId = req.getDocumentId();
                Long whId = derivedWhIds.get(i);

                String vatKey = docId + "#" + whId;
                Long pdvId = vatByKey.get(vatKey);
                if (pdvId == null) {
                    return ServiceResponseDirector.errorBadRequest(
                            PDV_MISSING_FOR_DOC + docId + " in warehouse " + whId + "."
                    );
                }

                String attrError = validateItemAttrsPresent(req, attrsByItem, i);
                if (attrError != null) {
                    return ServiceResponseDirector.errorBadRequest(attrError);
                }

                List<DocumentItemLineDTO> prepared = prepareLines(req, attrsByItem, pdvId);
                lineRepo.insert(hdr.getId(), prepared);
            }

            List<DispatchResponseDTO> out = persistedHeaders.stream()
                    .map(h -> {
                        DispatchResponseDTO dto = mapper.toResponse(h);
                        dto.setStatus(Boolean.TRUE.equals(h.getPosted()) ? "POSTED" : "DRAFT");
                        return dto;
                    })
                    .collect(Collectors.toList());

            return ServiceResponseDirector.successOk(out, "Bulk dispatch processed.");
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal(
                    "Bulk booking failed; nothing was booked: " + e.getMessage()
            );
        }
    }

    @Transactional
    public ServiceResponse<PagedResult<DispatchSummaryResponseDTO>> searchDispatches(DispatchSearchFilter filter) {
        try {
            long total = headerRepo.countFiltered(filter);
            List<DocumentHeaderEntity> headers = headerRepo.pageFiltered(filter);

            List<DispatchSummaryResponseDTO> dtoItems = headers.stream()
                    .map(mapper::toDto)
                    .collect(Collectors.toList());

            PagedResult<DispatchSummaryResponseDTO> result = PagedResult.<DispatchSummaryResponseDTO>builder()
                    .items(dtoItems)
                    .page(filter.getPage())
                    .size(filter.getSize())
                    .total(total)
                    .build();

            return ServiceResponseDirector.successOk(result, "OK");
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal(
                    "Failed to search dispatch notes: " + e.getMessage()
            );
        }
    }

    @Transactional
    public ServiceResponse<DispatchResponseDTO> updateDispatch(Long headerId, DispatchUpdateRequestDTO body) {
        try {
            DocumentHeaderEntity existing = headerRepo.findHeader(headerId);
            if (existing == null) {
                return ServiceResponseDirector.errorNotFound("Dispatch " + headerId + " not found.");
            }

            if (body.isCancel()) {
                if (!Boolean.TRUE.equals(existing.getPosted())) {
                    return ServiceResponseDirector.errorBadRequest("Cannot cancel: dispatch is not POSTED.");
                }
                if (existing.getCancelledBy() != null) {
                    return ServiceResponseDirector.errorBadRequest("Cannot cancel: already CANCELLED.");
                }

                DocumentHeaderEntity cancelled = headerRepo.cancelDispatch(
                        headerId,
                        body.getActorUserId(),
                        body.getCancelReason()
                );
                if (cancelled == null) {
                    return ServiceResponseDirector.errorBadRequest(
                            "Unable to cancel (already cancelled or not posted)."
                    );
                }

                DispatchResponseDTO dto = mapper.toResponse(cancelled);
                dto.setStatus("CANCELLED");

                return ServiceResponseDirector.successOk(dto, "Dispatch cancelled.");
            }

            if (Boolean.TRUE.equals(existing.getPosted())) {
                return ServiceResponseDirector.errorBadRequest("Cannot edit: dispatch already POSTED.");
            }
            if (existing.getCancelledBy() != null) {
                return ServiceResponseDirector.errorBadRequest("Cannot edit: dispatch CANCELLED.");
            }

            Long derivedWarehouseId = slotRepo.warehouseForDocument(existing.getDocumentId());
            if (derivedWarehouseId == null) {
                return ServiceResponseDirector.errorInternal(
                        "Cannot resolve warehouse for documentId=" + existing.getDocumentId()
                );
            }

            Set<Long> itemIds = body.getItems().stream()
                    .map(DispatchUpdateRequestDTO.DispatchItemPatch::getItemId)
                    .collect(Collectors.toSet());

            for (Long itId : itemIds) {
                if (itemRepo.isMissingOrInactive(itId)) {
                    return ServiceResponseDirector.errorBadRequest(
                            "Item not found or inactive: " + itId
                    );
                }
            }

            Map<Long, DocumentItemAttributesView> attrsByItem = itemAttrsRepo.findAttributes(itemIds);

            Long pdvId = resolveVat(existing.getDocumentId(), derivedWarehouseId);
            if (pdvId == null) {
                return ServiceResponseDirector.errorBadRequest(
                        "No PDV_ID for documentId=" + existing.getDocumentId()
                                + " and warehouseId=" + derivedWarehouseId
                );
            }

            List<DocumentItemLineDTO> newLines = new ArrayList<>(body.getItems().size());
            for (DispatchUpdateRequestDTO.DispatchItemPatch p : body.getItems()) {
                DocumentItemAttributesView a = attrsByItem.get(p.getItemId());
                if (a == null || a.getNameId() == null || a.getUnitOfMeasureId() == null) {
                    return ServiceResponseDirector.errorBadRequest(
                            "Item attributes missing (NAZIV_ID/JMJ_ID) for itemId=" + p.getItemId()
                    );
                }

                newLines.add(
                        DocumentItemLineDTO.builder()
                                .itemId(p.getItemId())
                                .quantity(BigDecimal.valueOf(p.getQuantity()))
                                .nameId(a.getNameId())
                                .unitOfMeasureId(a.getUnitOfMeasureId())
                                .valueAddedTaxId(pdvId)
                                .build()
                );
            }

            lineRepo.deleteByHeader(existing.getId());
            lineRepo.insert(existing.getId(), newLines);

            DocumentHeaderEntity updatedHeader = headerRepo.updateDraftHeader(
                    headerId,
                    body.getPartnerId(),
                    body.getOverrideNote()
            );

            if (updatedHeader == null) {
                return ServiceResponseDirector.errorBadRequest(
                        "Draft update failed (maybe already posted or cancelled)"
                );
            }

            DispatchResponseDTO dto = mapper.toResponse(updatedHeader);
            dto.setStatus("DRAFT");

            return ServiceResponseDirector.successOk(dto, "Draft dispatch updated.");

        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal(
                    "Failed to update dispatch note: " + e.getMessage()
            );
        }
    }

    private Map<String, Long> resolveVatForRequests(
            List<DispatchRequestDTO> requests,
            List<Long> derivedWhIds
    ) throws Exception {

        Map<String, Long> vatByKey = new HashMap<>();

        for (int i = 0; i < requests.size(); i++) {
            DispatchRequestDTO r = requests.get(i);
            Long docId = r.getDocumentId();
            Long whId = derivedWhIds.get(i);

            String key = docId + "#" + whId;
            if (!vatByKey.containsKey(key)) {
                Long vat = resolveVat(docId, whId);
                if (vat == null) {
                    throw new IllegalStateException(
                            "No PDV_ID for documentId=" + docId
                                    + " and warehouseId=" + whId
                    );
                }
                vatByKey.put(key, vat);
            }
        }
        return vatByKey;
    }

    private String validateReferences(DispatchRequestDTO r, Long warehouseId, int idx) throws Exception {
        if (warehouseId == null) {
            return REQ_PREFIX + idx + "]: cannot resolve warehouse for documentId=" + r.getDocumentId();
        }

        if (!slotRepo.existsForWarehouse(r.getDocumentId(), warehouseId)) {
            return REQ_PREFIX + idx + "]: unknown (documentId, warehouseId)=(" +
                    r.getDocumentId() + "," + warehouseId + ")";
        }

        if (partnerRepo.isMissingOrInactive(r.getPartnerId())) {
            return REQ_PREFIX + idx + "]: partner not found or inactive: " + r.getPartnerId();
        }
        for (DispatchRequestDTO.DispatchItemRequest it : r.getItems()) {
            if (itemRepo.isMissingOrInactive(it.getItemId())) {
                return REQ_PREFIX + idx + "]: item not found or inactive: " + it.getItemId();
            }
        }
        return null;
    }

    private Long resolveVat(Long documentId, Long warehouseId) throws Exception {
        var opt = vatLookupRepo.valueAddedTaxIdForDocumentAndWarehouse(documentId, warehouseId);
        return opt.orElse(null);
    }

    private static String validateItemAttrsPresent(
            DispatchRequestDTO req,
            Map<Long, DocumentItemAttributesView> attrsByItem,
            int idx
    ) {
        for (DispatchRequestDTO.DispatchItemRequest it : req.getItems()) {
            DocumentItemAttributesView a = attrsByItem.get(it.getItemId());
            if (a == null || a.getNameId() == null || a.getUnitOfMeasureId() == null) {
                return REQ_PREFIX + idx + "]: item attributes missing (NAZIV_ID/JMJ_ID) for itemId=" + it.getItemId();
            }
        }
        return null;
    }

    private static List<DocumentItemLineDTO> prepareLines(
            DispatchRequestDTO req,
            Map<Long, DocumentItemAttributesView> attrsByItem,
            Long pdvId
    ) {
        List<DocumentItemLineDTO> out = new ArrayList<>(req.getItems().size());
        for (DispatchRequestDTO.DispatchItemRequest it : req.getItems()) {
            DocumentItemAttributesView a = attrsByItem.get(it.getItemId());
            out.add(DocumentItemLineDTO.builder()
                    .itemId(it.getItemId())
                    .quantity(BigDecimal.valueOf(it.getQuantity()))
                    .nameId(a.getNameId())
                    .unitOfMeasureId(a.getUnitOfMeasureId())
                    .valueAddedTaxId(pdvId)
                    .build());
        }
        return out;
    }
}
