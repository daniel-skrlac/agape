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
            String err = validateReferences(req, 0);
            if (err != null) return ServiceResponseDirector.errorBadRequest(err);

            Long docId = req.getDocumentId();
            Long whId = req.getWarehouseId();

            Integer pdvId = resolveVat(docId, whId);
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
            if (err != null) return ServiceResponseDirector.errorBadRequest(err);

            DocumentHeaderEntity headerInput = mapper.toHeader(req);

            boolean postNow = !req.isDraft();
            DocumentHeaderEntity header = headerRepo.insert(headerInput, postNow);

            int nextLineNo = lineRepo.nextLineNumber(header.getId());
            List<DocumentItemLineDTO> prepared =
                    prepareLines(req, attrsByItem, pdvId, nextLineNo);

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
            for (int i = 0; i < requests.size(); i++) {
                String err = validateReferences(requests.get(i), i);
                if (err != null) {
                    return ServiceResponseDirector.errorBadRequest(err);
                }
            }

            Map<String, Integer> vatByKey = resolveVatForRequests(requests);

            Set<Long> allItemIds = requests.stream()
                    .flatMap(r -> r.getItems().stream())
                    .map(DispatchRequestDTO.DispatchItemRequest::getItemId)
                    .collect(Collectors.toSet());

            Map<Long, DocumentItemAttributesView> attrsByItem =
                    itemAttrsRepo.findAttributes(allItemIds);

            List<DocumentHeaderEntity> persistedHeaders = new ArrayList<>(requests.size());
            for (DispatchRequestDTO r : requests) {
                DocumentHeaderEntity hdrIn = mapper.toHeader(r);
                boolean postNow = !r.isDraft(); // true => POSTED, false => DRAFT
                DocumentHeaderEntity hdr = headerRepo.insert(hdrIn, postNow);
                persistedHeaders.add(hdr);
            }

            for (int i = 0; i < requests.size(); i++) {
                DispatchRequestDTO req = requests.get(i);
                DocumentHeaderEntity hdr = persistedHeaders.get(i);

                String vatKey = req.getDocumentId() + "#" + req.getWarehouseId();
                Integer pdvId = vatByKey.get(vatKey);
                if (pdvId == null) {
                    return ServiceResponseDirector.errorBadRequest(
                            PDV_MISSING_FOR_DOC + req.getDocumentId()
                                    + " in warehouse " + req.getWarehouseId() + "."
                    );
                }

                String attrError = validateItemAttrsPresent(req, attrsByItem, i);
                if (attrError != null) {
                    return ServiceResponseDirector.errorBadRequest(attrError);
                }

                int nextLineNo = lineRepo.nextLineNumber(hdr.getId());
                List<DocumentItemLineDTO> prepared =
                        prepareLines(req, attrsByItem, pdvId, nextLineNo);

                lineRepo.insert(hdr.getId(), prepared);
            }

            List<DispatchResponseDTO> out = persistedHeaders.stream()
                    .map(h -> {
                        DispatchResponseDTO dto = mapper.toResponse(h);
                        dto.setStatus(Boolean.TRUE.equals(h.getPosted()) ? "POSTED" : "DRAFT");
                        return dto;
                    })
                    .collect(Collectors.toList());

            return ServiceResponseDirector.successOk(
                    out,
                    "Bulk dispatch processed."
            );
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
            // Load header
            DocumentHeaderEntity existing = headerRepo.findHeader(headerId);
            if (existing == null) {
                return ServiceResponseDirector.errorNotFound("Dispatch " + headerId + " not found.");
            }

            // CANCEL FLOW
            if (body.isCancel()) {
                // must be POSTED and not CANCELLED already
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
                    return ServiceResponseDirector.errorBadRequest("Unable to cancel (already cancelled or not posted).");
                }

                return ServiceResponseDirector.successOk(
                        mapper.toResponse(cancelled),
                        "Dispatch cancelled."
                );
            }

            // EDIT DRAFT FLOW
            // Only allowed if not posted and not cancelled
            if (Boolean.TRUE.equals(existing.getPosted())) {
                return ServiceResponseDirector.errorBadRequest("Cannot edit: dispatch already POSTED.");
            }
            if (existing.getCancelledBy() != null) {
                return ServiceResponseDirector.errorBadRequest("Cannot edit: dispatch CANCELLED.");
            }

            // if items provided -> replace lines
            if (body.getItems() != null && !body.getItems().isEmpty()) {
                // validate each item is active
                Set<Long> itemIds = body.getItems().stream()
                        .map(DispatchUpdateRequestDTO.DispatchItemPatch::getItemId)
                        .collect(Collectors.toSet());

                for (Long itId : itemIds) {
                    if (itemRepo.isMissingOrInactive(itId.intValue())) {
                        return ServiceResponseDirector.errorBadRequest(
                                "Item not found or inactive: " + itId
                        );
                    }
                }

                // attributes
                Map<Long, DocumentItemAttributesView> attrsByItem = itemAttrsRepo.findAttributes(itemIds);

                // we STILL need PDV_ID for each line. We do not currently persist warehouseId in header,
                // which means we don't know which warehouse's VAT rule applies after the fact.
                // TEMP approach: assume warehouseId=1 or some fixed known warehouse.
                // You SHOULD persist warehouseId in SD_GLAVA in real life.
                Integer pdvId = resolveVat(existing.getDocumentId(), 1L);
                if (pdvId == null) {
                    return ServiceResponseDirector.errorBadRequest(
                            "No PDV_ID for documentId=" + existing.getDocumentId()
                                    + " (updateDraftHeader). Warehouse missing in header."
                    );
                }

                // build fresh lines
                List<DocumentItemLineDTO> newLines = new ArrayList<>(body.getItems().size());
                int ln = 1;
                for (DispatchUpdateRequestDTO.DispatchItemPatch p : body.getItems()) {
                    DocumentItemAttributesView a = attrsByItem.get(p.getItemId());
                    if (a == null || a.getNameId() == null || a.getUnitOfMeasureId() == null) {
                        return ServiceResponseDirector.errorBadRequest(
                                "Item attributes missing (NAZIV_ID/JMJ_ID) for itemId=" + p.getItemId()
                        );
                    }

                    newLines.add(
                            DocumentItemLineDTO.builder()
                                    .itemId(p.getItemId().intValue())
                                    .quantity(BigDecimal.valueOf(p.getQuantity()))
                                    .nameId(a.getNameId())
                                    .unitOfMeasureId(a.getUnitOfMeasureId())
                                    .valueAddedTaxId(pdvId)
                                    .lineNumber(ln++)
                                    .build()
                    );
                }

                // replace lines in DB
                lineRepo.deleteByHeader(existing.getId());
                lineRepo.insert(existing.getId(), newLines);
            }

            // update draft header itself (partner, note)
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

            return ServiceResponseDirector.successOk(
                    mapper.toResponse(updatedHeader),
                    "Draft dispatch updated."
            );

        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal(
                    "Failed to update dispatch note: " + e.getMessage()
            );
        }
    }

    // helpers

    private Map<String, Integer> resolveVatForRequests(List<DispatchRequestDTO> requests) throws Exception {
        Map<String, Integer> vatByKey = new HashMap<>();
        for (DispatchRequestDTO r : requests) {
            String key = r.getDocumentId() + "#" + r.getWarehouseId();
            if (!vatByKey.containsKey(key)) {
                Integer vat = resolveVat(r.getDocumentId(), r.getWarehouseId());
                if (vat == null) {
                    throw new IllegalStateException(
                            "No PDV_ID for documentId=" + r.getDocumentId()
                                    + " and warehouseId=" + r.getWarehouseId()
                    );
                }
                vatByKey.put(key, vat);
            }
        }
        return vatByKey;
    }

    private String validateReferences(DispatchRequestDTO r, int idx) throws Exception {
        if (!slotRepo.existsForWarehouse(r.getDocumentId().intValue(), r.getWarehouseId().intValue())) {
            return REQ_PREFIX + idx + "]: unknown (documentId, warehouseId)=(" +
                    r.getDocumentId() + "," + r.getWarehouseId() + ")";
        }
        if (partnerRepo.isMissingOrInactive(r.getPartnerId().intValue())) {
            return REQ_PREFIX + idx + "]: partner not found or inactive: " + r.getPartnerId();
        }
        for (DispatchRequestDTO.DispatchItemRequest it : r.getItems()) {
            if (itemRepo.isMissingOrInactive(it.getItemId().intValue())) {
                return REQ_PREFIX + idx + "]: item not found or inactive: " + it.getItemId();
            }
        }
        return null;
    }

    private Integer resolveVat(Long documentId, Long warehouseId) throws Exception {
        var opt = vatLookupRepo.valueAddedTaxIdForDocumentAndWarehouse(
                documentId.intValue(),
                warehouseId.intValue()
        );
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
            Integer pdvId,
            int startingLineNo
    ) {
        int ln = startingLineNo;
        List<DocumentItemLineDTO> out = new ArrayList<>(req.getItems().size());
        for (DispatchRequestDTO.DispatchItemRequest it : req.getItems()) {
            DocumentItemAttributesView a = attrsByItem.get(it.getItemId());
            out.add(DocumentItemLineDTO.builder()
                    .itemId(it.getItemId().intValue())
                    .quantity(BigDecimal.valueOf(it.getQuantity()))
                    .nameId(a.getNameId())
                    .unitOfMeasureId(a.getUnitOfMeasureId())
                    .valueAddedTaxId(pdvId)
                    .lineNumber(ln++)
                    .build());
        }
        return out;
    }
}
