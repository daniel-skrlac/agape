package hr.agape.dispatch.service;

import hr.agape.common.response.ServiceResponse;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchResponseDTO;
import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.mapper.DispatchApiMapper;
import hr.agape.document.domain.DocumentHeader;
import hr.agape.document.repository.DocumentRulesRepository;
import hr.agape.document.ref.domain.ItemAttributes;
import hr.agape.document.ref.domain.PreparedLine;
import hr.agape.document.ref.repository.ItemAttributesRepository;
import hr.agape.document.ref.repository.ItemRepository;
import hr.agape.document.ref.repository.PartnerRepository;
import hr.agape.document.repository.DocumentHeaderRepository;
import hr.agape.document.repository.DocumentLineRepository;
import hr.agape.document.repository.DocumentTypeRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.TransactionSynchronizationRegistry;
import jakarta.transaction.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class DispatchBookingService {

    private static final String REQ_PREFIX = "Request[";
    private static final String AT_LEAST_ONE_ITEM_REQUIRED = "]: at least one item is required.";
    private static final String PDV_MISSING_FOR_DOC = "No PDV_ID found for documentId=";

    private final DocumentHeaderRepository headerRepo;
    private final DocumentLineRepository lineRepo;
    private final DispatchApiMapper mapper;
    private final DocumentTypeRepository docTypeRepo;
    private final PartnerRepository partnerRepo;
    private final ItemRepository itemRepo;
    private final TransactionSynchronizationRegistry tsr;
    private final DocumentRulesRepository rulesRepo;
    private final ItemAttributesRepository itemAttrsRepo;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public DispatchBookingService(
            DocumentHeaderRepository headerRepo,
            DocumentLineRepository lineRepo,
            DispatchApiMapper mapper,
            DocumentTypeRepository docTypeRepo,
            PartnerRepository partnerRepo,
            ItemRepository itemRepo,
            TransactionSynchronizationRegistry tsr,
            DocumentRulesRepository rulesRepo,
            ItemAttributesRepository itemAttrsRepo
    ) {
        this.headerRepo = headerRepo;
        this.lineRepo = lineRepo;
        this.mapper = mapper;
        this.docTypeRepo = docTypeRepo;
        this.partnerRepo = partnerRepo;
        this.itemRepo = itemRepo;
        this.tsr = tsr;
        this.rulesRepo = rulesRepo;
        this.itemAttrsRepo = itemAttrsRepo;
    }

    @Transactional
    public ServiceResponse<DispatchResponseDTO> bookOne(DispatchRequestDTO req) {
        try {
            String err = validateReferences(req, 0);
            if (err != null) return ServiceResponseDirector.errorBadRequest(err);

            Integer pdvId = resolveVat(req.getDocumentId());
            if (pdvId == null) {
                return ServiceResponseDirector.errorBadRequest(PDV_MISSING_FOR_DOC + req.getDocumentId() + ".");
            }

            Map<Integer, ItemAttributes> attrsByItem =
                    itemAttrsRepo.findAttributes(req.getItems().stream()
                            .map(DispatchRequestDTO.DispatchItemRequest::getItemId)
                            .collect(Collectors.toSet()));

            err = validateItemAttrsPresent(req, attrsByItem, 0);
            if (err != null) return ServiceResponseDirector.errorBadRequest(err);

            DocumentHeader header = headerRepo.insert(mapper.toHeader(req));
            int nextLineNo = lineRepo.nextLineNumber(header.getId());
            List<PreparedLine> prepared = prepareLines(req, attrsByItem, pdvId, nextLineNo);

            lineRepo.insert(header.getId(), prepared);

            return ServiceResponseDirector.successOk(
                    mapper.toResponse(header),
                    "Dispatch note booked."
            );
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal("Failed to book dispatch note: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponse<List<DispatchResponseDTO>> bookBulk(List<DispatchRequestDTO> requests) {
        try {
            Set<Integer> distinctDocIds = new HashSet<>();
            Set<Integer> distinctItemIds = new HashSet<>();
            String err = collectDistinctIds(requests, distinctDocIds, distinctItemIds);
            if (err != null) return ServiceResponseDirector.errorBadRequest(err);

            err = validateAllReferences(requests);
            if (err != null) return ServiceResponseDirector.errorBadRequest(err);

            Map<Integer, Integer> vatByDocId = resolveVatForDocs(distinctDocIds);

            Map<Integer, ItemAttributes> attrsByItem = itemAttrsRepo.findAttributes(distinctItemIds);

            List<DocumentHeader> persistedHeaders = headerRepo.insertAll(
                    requests.stream().map(mapper::toHeader).collect(Collectors.toList())
            );

            for (int i = 0; i < requests.size(); i++) {
                DispatchRequestDTO req = requests.get(i);
                DocumentHeader hdr = persistedHeaders.get(i);

                Integer pdvId = vatByDocId.get(hdr.getDocumentId());
                if (pdvId == null) {
                    return ServiceResponseDirector.errorBadRequest(PDV_MISSING_FOR_DOC + hdr.getDocumentId() + ".");
                }

                String attrError = validateItemAttrsPresent(req, attrsByItem, i);
                if (attrError != null) return ServiceResponseDirector.errorBadRequest(attrError);

                int nextLineNo = lineRepo.nextLineNumber(hdr.getId());
                List<PreparedLine> prepared = prepareLines(req, attrsByItem, pdvId, nextLineNo);

                lineRepo.insert(hdr.getId(), prepared);
            }

            List<DispatchResponseDTO> out = persistedHeaders.stream()
                    .map(mapper::toResponse)
                    .collect(Collectors.toList());

            return ServiceResponseDirector.successOk(out, "Bulk dispatch booking completed.");
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal("Bulk booking failed; nothing was booked: " + e.getMessage());
        }
    }

    private String validateReferences(DispatchRequestDTO r, int idx) throws Exception {
        if (docTypeRepo.findTypeForDocumentId(r.getDocumentId()).isEmpty()) {
            return REQ_PREFIX + idx + "]: unknown documentId " + r.getDocumentId();
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

    private String collectDistinctIds(
            List<DispatchRequestDTO> requests,
            Set<Integer> distinctDocIds,
            Set<Integer> distinctItemIds
    ) {
        for (DispatchRequestDTO r : requests) {
            distinctDocIds.add(r.getDocumentId());
            for (DispatchRequestDTO.DispatchItemRequest it : r.getItems()) {
                distinctItemIds.add(it.getItemId());
            }
        }
        return null;
    }

    private String validateAllReferences(List<DispatchRequestDTO> requests) throws Exception {
        for (int i = 0; i < requests.size(); i++) {
            String err = validateReferences(requests.get(i), i);
            if (err != null) return err;
        }
        return null;
    }

    private Integer resolveVat(Integer documentId) throws Exception {
        var opt = rulesRepo.valueAddedTaxIdForDocumentId(documentId);
        return opt.orElse(null);
    }

    private Map<Integer, Integer> resolveVatForDocs(Set<Integer> distinctDocIds) throws Exception {
        Map<Integer, Integer> vatByDocId = new HashMap<>(Math.max(16, distinctDocIds.size() * 2));
        for (Integer docId : distinctDocIds) {
            Integer pdv = resolveVat(docId);
            if (pdv == null) return Map.of();
            vatByDocId.put(docId, pdv);
        }
        return vatByDocId;
    }

    private static String validateItemAttrsPresent(
            DispatchRequestDTO req,
            Map<Integer, ItemAttributes> attrsByItem,
            int idx
    ) {
        for (DispatchRequestDTO.DispatchItemRequest it : req.getItems()) {
            ItemAttributes a = attrsByItem.get(it.getItemId());
            if (a == null || a.getNameId() == null || a.getUnitOfMeasureId() == null) {
                return REQ_PREFIX + idx + "]: item attributes missing (NAZIV_ID/JMJ_ID) for itemId=" + it.getItemId();
            }
        }
        return null;
    }

    private static List<PreparedLine> prepareLines(
            DispatchRequestDTO req,
            Map<Integer, ItemAttributes> attrsByItem,
            Integer pdvId,
            int startingLineNo
    ) {
        int ln = startingLineNo;
        List<PreparedLine> out = new ArrayList<>(req.getItems().size());
        for (DispatchRequestDTO.DispatchItemRequest it : req.getItems()) {
            ItemAttributes a = attrsByItem.get(it.getItemId());
            out.add(PreparedLine.builder()
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
