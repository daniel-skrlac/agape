package hr.agape.dispatch.service;

import hr.agape.common.response.ServiceResponse;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchResponseDTO;
import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.mapper.DispatchApiMapper;
import hr.agape.document.domain.DocumentHeaderEntity;
import hr.agape.document.lookup.repository.DocumentVatLookupRepository;
import hr.agape.document.lookup.view.DocumentItemAttributesView;
import hr.agape.document.dto.DocumentItemLineDTO;
import hr.agape.document.lookup.repository.DocumentItemLookupRepository;
import hr.agape.document.repository.DocumentItemRepository;
import hr.agape.document.repository.DocumentSlotRepository;
import hr.agape.document.warehouse.repository.PartnerRepository;
import hr.agape.document.repository.DocumentHeaderRepository;
import hr.agape.document.repository.DocumentLineRepository;
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
            DocumentSlotRepository slotRepo, DocumentVatLookupRepository vatLookupRepo, DocumentHeaderRepository headerRepo,
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

            Integer pdvId = resolveVat(req.getDocumentId(), req.getWarehouseId());
            if (pdvId == null) {
                return ServiceResponseDirector.errorBadRequest(
                        PDV_MISSING_FOR_DOC + req.getDocumentId()
                                + " in warehouse " + req.getWarehouseId() + "."
                );
            }

            Map<Integer, DocumentItemAttributesView> attrsByItem =
                    itemAttrsRepo.findAttributes(
                            req.getItems().stream()
                                    .map(DispatchRequestDTO.DispatchItemRequest::getItemId)
                                    .collect(Collectors.toSet())
                    );

            err = validateItemAttrsPresent(req, attrsByItem, 0);
            if (err != null) return ServiceResponseDirector.errorBadRequest(err);

            DocumentHeaderEntity header = headerRepo.insert(mapper.toHeader(req));

            int nextLineNo = lineRepo.nextLineNumber(header.getId());
            List<DocumentItemLineDTO> prepared =
                    prepareLines(req, attrsByItem, pdvId, nextLineNo);

            lineRepo.insert(header.getId(), prepared);

            return ServiceResponseDirector.successOk(
                    mapper.toResponse(header),
                    "Dispatch note booked."
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
                if (err != null) return ServiceResponseDirector.errorBadRequest(err);
            }

            Map<String, Integer> vatByKey = resolveVatForRequests(requests);

            Set<Integer> allItemIds = requests.stream()
                    .flatMap(r -> r.getItems().stream())
                    .map(DispatchRequestDTO.DispatchItemRequest::getItemId)
                    .collect(Collectors.toSet());

            Map<Integer, DocumentItemAttributesView> attrsByItem = itemAttrsRepo.findAttributes(allItemIds);

            List<DocumentHeaderEntity> persistedHeaders = headerRepo.insertAll(
                    requests.stream().map(mapper::toHeader).collect(Collectors.toList())
            );

            for (int i = 0; i < requests.size(); i++) {
                DispatchRequestDTO req = requests.get(i);
                DocumentHeaderEntity hdr = persistedHeaders.get(i);

                String vatKey = req.getDocumentId() + "#" + req.getWarehouseId();
                Integer pdvId = vatByKey.get(vatKey);
                if (pdvId == null) {
                    return ServiceResponseDirector.errorBadRequest(
                            PDV_MISSING_FOR_DOC + req.getDocumentId()
                                    + " in warehouse " + req.getWarehouseId() + ".");
                }

                String attrError = validateItemAttrsPresent(req, attrsByItem, i);
                if (attrError != null) return ServiceResponseDirector.errorBadRequest(attrError);

                int nextLineNo = lineRepo.nextLineNumber(hdr.getId());
                List<DocumentItemLineDTO> prepared =
                        prepareLines(req, attrsByItem, pdvId, nextLineNo);

                lineRepo.insert(hdr.getId(), prepared);
            }

            List<DispatchResponseDTO> out = persistedHeaders.stream()
                    .map(mapper::toResponse)
                    .collect(Collectors.toList());

            return ServiceResponseDirector.successOk(out, "Bulk dispatch booking completed.");
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal(
                    "Bulk booking failed; nothing was booked: " + e.getMessage());
        }
    }

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
        if (!slotRepo.existsForWarehouse(r.getDocumentId(), r.getWarehouseId())) {
            return REQ_PREFIX + idx + "]: unknown (documentId, warehouseId)=(" +
                    r.getDocumentId() + "," + r.getWarehouseId() + ")";
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

    private Integer resolveVat(Integer documentId, Integer warehouseId) throws Exception {
        var opt = vatLookupRepo.valueAddedTaxIdForDocumentAndWarehouse(documentId, warehouseId);
        return opt.orElse(null);
    }

    private static String validateItemAttrsPresent(
            DispatchRequestDTO req,
            Map<Integer, DocumentItemAttributesView> attrsByItem,
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
            Map<Integer, DocumentItemAttributesView> attrsByItem,
            Integer pdvId,
            int startingLineNo
    ) {
        int ln = startingLineNo;
        List<DocumentItemLineDTO> out = new ArrayList<>(req.getItems().size());
        for (DispatchRequestDTO.DispatchItemRequest it : req.getItems()) {
            DocumentItemAttributesView a = attrsByItem.get(it.getItemId());
            out.add(DocumentItemLineDTO.builder()
                    .itemId(it.getItemId())
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
