package hr.agape.dispatch.service;

import hr.agape.common.config.AgapeConfig;
import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchBulkItemResultDTO;
import hr.agape.dispatch.dto.DispatchBulkResponseDTO;
import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.dto.DispatchResponseDTO;
import hr.agape.dispatch.dto.DispatchSearchFilter;
import hr.agape.dispatch.dto.DispatchSummaryResponseDTO;
import hr.agape.dispatch.dto.DispatchUpdateRequestDTO;
import hr.agape.dispatch.enumeration.DispatchStatusEnum;
import hr.agape.dispatch.enumeration.DocumentTextType;
import hr.agape.dispatch.mapper.DispatchApiMapper;
import hr.agape.document.domain.DocumentHeaderEntity;
import hr.agape.document.dto.DocumentItemLineDTO;
import hr.agape.document.lookup.repository.DocumentItemLookupRepository;
import hr.agape.document.lookup.view.DocumentItemAttributesView;
import hr.agape.document.repository.DocumentHeaderRepository;
import hr.agape.document.repository.DocumentSlotRepository;
import hr.agape.document.user.repository.UserRepository;
import hr.agape.document.warehouse.service.WarehouseService;
import hr.agape.partner.repository.PartnerRepository;
import hr.agape.user.util.AuthUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class DispatchBookingService {

    private static final String REQ_PREFIX = "Request[";

    private final DocumentSlotRepository slotRepo;
    private final WarehouseService warehouseService;
    private final DocumentHeaderRepository headerRepo;
    private final DispatchApiMapper mapper;
    private final PartnerRepository partnerRepo;
    private final hr.agape.document.repository.DocumentItemRepository itemRepo;
    private final DocumentItemLookupRepository itemAttrsRepo;
    private final AuthUtil authUtil;
    private final DispatchBookingTransactionService tx;
    private final UserRepository userRepo;
    private final AgapeConfig agapeConfig;

    @Inject
    public DispatchBookingService(
            DocumentSlotRepository slotRepo,
            WarehouseService warehouseService,
            DocumentHeaderRepository headerRepo,
            DispatchApiMapper mapper,
            PartnerRepository partnerRepo,
            hr.agape.document.repository.DocumentItemRepository itemRepo,
            DocumentItemLookupRepository itemAttrsRepo,
            AuthUtil authUtil,
            DispatchBookingTransactionService tx, UserRepository userRepo, AgapeConfig agapeConfig
    ) {
        this.slotRepo = slotRepo;
        this.warehouseService = warehouseService;
        this.headerRepo = headerRepo;
        this.mapper = mapper;
        this.partnerRepo = partnerRepo;
        this.itemRepo = itemRepo;
        this.itemAttrsRepo = itemAttrsRepo;
        this.authUtil = authUtil;
        this.tx = tx;
        this.userRepo = userRepo;
        this.agapeConfig = agapeConfig;
    }

    /**
     * BOOK ONE:
     * - TX#1 REQUIRED: create draft header+lines
     * - TX#2 REQUIRES_NEW: call PL/SQL posting (commits internally)
     */
    public ServiceResponseDTO<DispatchResponseDTO> bookOne(DispatchRequestDTO req) {
        try {
            Long actorOibNum = authUtil.requireOibAsLong();
            String actorOibDigits = authUtil.requireOibDigits();
            var user = userRepo.findByOib();
            if (user == null) {
                return ServiceResponseDirector.errorBadRequest("No KORISNIK found");
            }
            req.setCreatedBy(actorOibNum);

            Long whId = slotRepo.warehouseForDocument(req.getDocumentId());
            String err = validateReferences(req, whId, 0);
            if (err != null) return ServiceResponseDirector.errorBadRequest(err);

            Long pdvId = warehouseService.resolveVatIdForUser(whId, user.getUserId());
            if (pdvId == null) {
                return ServiceResponseDirector.errorBadRequest("Mapped PDV_ID= does not exist for given warehouse.");
            }

            Set<Long> itemIds = req.getItems().stream()
                    .map(DispatchRequestDTO.DispatchItemRequest::getItemId)
                    .collect(Collectors.toSet());

            Map<Long, DocumentItemAttributesView> attrsByItem = itemAttrsRepo.findAttributes(itemIds);
            err = validateItemAttrsPresent(req, attrsByItem, 0);
            if (err != null) return ServiceResponseDirector.errorBadRequest(err);

            DocumentHeaderEntity headerInput = mapper.toHeader(req);
            headerInput.setTextType(DocumentTextType.OTPREMNICA);
            headerInput.setItemCount(req.getItems().size());

            List<DocumentItemLineDTO> prepared = prepareLines(req, attrsByItem, pdvId, user.getUserId());

            DocumentHeaderEntity created = tx.createDraft(headerInput, prepared);

            if (req.isDraft()) {
                DocumentHeaderEntity fresh = headerRepo.findHeader(created.getId());
                DispatchResponseDTO out = mapper.toResponse(fresh);
                out.setStatus(DispatchStatusEnum.DRAFT.name());
                return ServiceResponseDirector.successOk(out, "Dispatch note saved as DRAFT.");
            }

            tx.postViaProcedure(created.getId(), actorOibDigits);

            DocumentHeaderEntity posted = headerRepo.findHeader(created.getId());
            if (posted == null || !Boolean.TRUE.equals(posted.getPosted())) {
                DispatchResponseDTO out = mapper.toResponse(posted != null ? posted : created);
                out.setStatus(DispatchStatusEnum.DRAFT.name());
                return ServiceResponseDirector.errorBadRequest(
                        "Posting failed: KNJIZENO was not set to 1. HeaderId=" + created.getId()
                );
            }

            DispatchResponseDTO out = mapper.toResponse(posted);
            out.setStatus(DispatchStatusEnum.POSTED.name());
            return ServiceResponseDirector.successOk(out, "Dispatch note booked (POSTED).");

        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to book dispatch note: " + safeMsg(e));
        }
    }

    /**
     * BOOK BULK (partial success):
     * We DO NOT fail-fast.
     * For each request:
     * - validate
     * - create draft (REQUIRED)
     * - if not draft -> post (REQUIRES_NEW)
     * - collect success/failure per request
     * Because PL/SQL commits, you cannot do true "all-or-nothing".
     */
    public ServiceResponseDTO<DispatchBulkResponseDTO> bookBulk(List<DispatchRequestDTO> requests) {
        try {
            Long actorOibNum = authUtil.requireOibAsLong();
            String actorOibDigits = authUtil.requireOibDigits();
            var user = userRepo.findByOib();
            if (user == null) {
                return ServiceResponseDirector.errorBadRequest("No KORISNIK found.");
            }

            List<DispatchBulkItemResultDTO> results = new ArrayList<>(requests.size());

            List<Long> whByIdx = new ArrayList<>(requests.size());
            for (DispatchRequestDTO r : requests) {
                r.setCreatedBy(/*actorOibNum*/Long.parseLong(agapeConfig.oib()));
                whByIdx.add(slotRepo.warehouseForDocument(r.getDocumentId()));
            }

            Set<Long> allItemIds = requests.stream()
                    .filter(Objects::nonNull)
                    .map(DispatchRequestDTO::getItems)
                    .filter(Objects::nonNull)
                    .flatMap(List::stream)
                    .map(DispatchRequestDTO.DispatchItemRequest::getItemId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            Map<Long, DocumentItemAttributesView> attrsByItem = allItemIds.isEmpty()
                    ? Map.of()
                    : itemAttrsRepo.findAttributes(allItemIds);

            Map<Long, Long> pdvByWarehouse = new HashMap<>();
            for (Long whId : whByIdx) {
                if (whId == null) continue;
                pdvByWarehouse.computeIfAbsent(whId, k -> warehouseService.resolveVatIdForUser(k, user.getUserId()));
            }

            int postedCount = 0, draftCount = 0, successCount = 0, failCount = 0;

            for (int i = 0; i < requests.size(); i++) {
                DispatchRequestDTO req = requests.get(i);
                Long whId = whByIdx.get(i);

                var rb = DispatchBulkItemResultDTO.builder()
                        .index(i)
                        .documentId(req.getDocumentId())
                        .partnerId(req.getPartnerId())
                        .requestedDraft(req.isDraft());

                try {
                    String refErr = validateReferences(req, whId, i);
                    if (refErr != null) {
                        failCount++;
                        results.add(rb.success(false).status(DispatchStatusEnum.FAILED.name()).error(refErr).build());
                        continue;
                    }

                    Long pdvId = pdvByWarehouse.get(whId);
                    if (pdvId == null) {
                        failCount++;
                        results.add(rb.success(false)
                                .status(DispatchStatusEnum.FAILED.name())
                                .error(REQ_PREFIX + i + "]: cannot resolve PDV_ID for warehouseId=" + whId + " (mapping " +
                                        "missing or TAX_CATEGORY missing).")
                                .build());
                        continue;
                    }

                    String attrErr = validateItemAttrsPresent(req, attrsByItem, i);
                    if (attrErr != null) {
                        failCount++;
                        results.add(rb.success(false).status(DispatchStatusEnum.FAILED.name()).error(attrErr).build());
                        continue;
                    }

                    DocumentHeaderEntity headerInput = mapper.toHeader(req);
                    headerInput.setTextType(DocumentTextType.OTPREMNICA);
                    headerInput.setItemCount(req.getItems().size());

                    List<DocumentItemLineDTO> prepared = prepareLines(req, attrsByItem, pdvId, user.getUserId());

                    DocumentHeaderEntity created = tx.createDraft(headerInput, prepared);

                    if (req.isDraft()) {
                        DocumentHeaderEntity fresh = headerRepo.findHeader(created.getId());
                        DispatchResponseDTO dto = mapper.toResponse(fresh);
                        dto.setStatus(DispatchStatusEnum.DRAFT.name());

                        draftCount++;
                        successCount++;
                        results.add(rb.success(true)
                                .headerId(created.getId())
                                .status(DispatchStatusEnum.DRAFT.name())
                                .response(dto)
                                .build());
                        continue;
                    }

                    try {
                        tx.postViaProcedure(created.getId(), actorOibDigits);
                    } catch (Exception postEx) {
                        DocumentHeaderEntity fresh = headerRepo.findHeader(created.getId());
                        DispatchResponseDTO dto = mapper.toResponse(fresh != null ? fresh : created);

                        failCount++;
                        results.add(rb.success(false)
                                .headerId(created.getId())
                                .status(DispatchStatusEnum.FAILED.name())
                                .error("Posting failed: " + safeMsg(postEx))
                                .response(dto)
                                .build());
                        continue;
                    }

                    DocumentHeaderEntity posted = headerRepo.findHeader(created.getId());
                    if (posted == null || !Boolean.TRUE.equals(posted.getPosted())) {
                        failCount++;
                        results.add(rb.success(false)
                                .headerId(created.getId())
                                .status(DispatchStatusEnum.FAILED.name())
                                .error("Posting did not set KNJIZENO=1 (check PL/SQL / logs).")
                                .response(mapper.toResponse(posted != null ? posted : created))
                                .build());
                        continue;
                    }

                    DispatchResponseDTO dto = mapper.toResponse(posted);
                    dto.setStatus(DispatchStatusEnum.POSTED.name());

                    postedCount++;
                    successCount++;
                    results.add(rb.success(true)
                            .headerId(created.getId())
                            .status(DispatchStatusEnum.POSTED.name())
                            .response(dto)
                            .build());

                } catch (Exception ex) {
                    failCount++;
                    results.add(rb.success(false).status(DispatchStatusEnum.FAILED.name()).error(safeMsg(ex)).build());
                }
            }

            DispatchBulkResponseDTO out = DispatchBulkResponseDTO.builder()
                    .total(requests.size())
                    .succeeded(successCount)
                    .failed(failCount)
                    .posted(postedCount)
                    .drafts(draftCount)
                    .items(results)
                    .build();

            return ServiceResponseDirector.successOk(out, "Bulk dispatch processed (partial success supported).");

        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Bulk booking failed: " + safeMsg(e));
        }
    }

    public ServiceResponseDTO<PagedResultDTO<DispatchSummaryResponseDTO>> searchDispatches(DispatchSearchFilter filter) {
        try {
            long total = headerRepo.countFiltered(filter);
            List<DocumentHeaderEntity> headers = headerRepo.pageFiltered(filter);

            List<DispatchSummaryResponseDTO> dtoItems = headers.stream()
                    .map(mapper::toDto)
                    .collect(Collectors.toList());

            PagedResultDTO<DispatchSummaryResponseDTO> result = PagedResultDTO.<DispatchSummaryResponseDTO>builder()
                    .items(dtoItems)
                    .page(filter.getPage())
                    .size(filter.getSize())
                    .total(total)
                    .build();

            return ServiceResponseDirector.successOk(result, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to search dispatch notes: " + safeMsg(e));
        }
    }

    /**
     * UPDATE DISPATCH:
     * - cancel posted -> REQUIRED tx
     * - post now -> REQUIRES_NEW (procedure commits)
     * - edit draft -> REQUIRED (replace lines + update header)
     */
    public ServiceResponseDTO<DispatchResponseDTO> updateDispatch(Long headerId, DispatchUpdateRequestDTO body) {
        try {
            String actorOibDigits = authUtil.requireOibDigits();
            var user = userRepo.findByOib();
            if (user == null) {
                return ServiceResponseDirector.errorBadRequest("No KORISNIK found.");
            }

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

                tx.cancelViaProcedure(headerId, body.getCancelReason());

                DocumentHeaderEntity cancelled = headerRepo.findHeader(headerId);
                if (cancelled == null || cancelled.getCancelledBy() == null) {
                    return ServiceResponseDirector.errorBadRequest("Cancel procedure did not mark document as cancelled. Check Oracle logs.");
                }

                DispatchResponseDTO dto = mapper.toResponse(cancelled);
                dto.setStatus(DispatchStatusEnum.CANCELLED.name());
                return ServiceResponseDirector.successOk(dto, "Dispatch cancelled (storno).");
            }

            if (body.isPostNow()) {
                if (Boolean.TRUE.equals(existing.getPosted())) {
                    return ServiceResponseDirector.errorBadRequest("Already POSTED.");
                }
                if (existing.getCancelledBy() != null) {
                    return ServiceResponseDirector.errorBadRequest("Cannot post: dispatch CANCELLED.");
                }

                tx.postViaProcedure(existing.getId(), actorOibDigits);

                DocumentHeaderEntity posted = headerRepo.findHeader(existing.getId());
                if (posted == null || !Boolean.TRUE.equals(posted.getPosted())) {
                    return ServiceResponseDirector.errorBadRequest("Posting failed (KNJIZENO not set). Check PL/SQL logs.");
                }

                DispatchResponseDTO dto = mapper.toResponse(posted);
                dto.setStatus(DispatchStatusEnum.POSTED.name());
                return ServiceResponseDirector.successOk(dto, "Dispatch posted.");
            }

            if (Boolean.TRUE.equals(existing.getPosted())) {
                return ServiceResponseDirector.errorBadRequest("Cannot edit: dispatch already POSTED.");
            }
            if (existing.getCancelledBy() != null) {
                return ServiceResponseDirector.errorBadRequest("Cannot edit: dispatch CANCELLED.");
            }

            Long whId = slotRepo.warehouseForDocument(existing.getDocumentId());
            if (whId == null) {
                return ServiceResponseDirector.errorInternal("Cannot resolve warehouse for documentId=" + existing.getDocumentId());
            }

            Set<Long> itemIds = body.getItems().stream()
                    .map(DispatchUpdateRequestDTO.DispatchItemPatch::getItemId)
                    .collect(Collectors.toSet());

            for (Long itId : itemIds) {
                if (itemRepo.isMissingOrInactive(itId)) {
                    return ServiceResponseDirector.errorBadRequest("Item not found or inactive: " + itId);
                }
            }

            Map<Long, DocumentItemAttributesView> attrsByItem = itemAttrsRepo.findAttributes(itemIds);

            Long pdvId = warehouseService.resolveVatIdForUser(whId, user.getUserId());
            if (pdvId == null) {
                return ServiceResponseDirector.errorBadRequest("Mapped PDV_ID= does not exist for given warehouse.");
            }

            List<DocumentItemLineDTO> newLines = new ArrayList<>(body.getItems().size());
            long br = 1;
            for (DispatchUpdateRequestDTO.DispatchItemPatch p : body.getItems()) {
                DocumentItemAttributesView a = attrsByItem.get(p.getItemId());
                if (a == null || a.getNameId() == null || a.getUnitOfMeasureId() == null) {
                    return ServiceResponseDirector.errorBadRequest(
                            "Item attributes missing (NAZIV_ID/JMJ_ID) for itemId=" + p.getItemId()
                    );
                }

                newLines.add(DocumentItemLineDTO.builder()
                        .itemId(p.getItemId())
                        .quantity(BigDecimal.valueOf(p.getQuantity()))
                        .nameId(a.getNameId())
                        .unitOfMeasureId(a.getUnitOfMeasureId())
                        .valueAddedTaxId(pdvId)
                        .lineNumber(br++)
                        .build());
            }

            DocumentHeaderEntity updated = tx.updateDraft(headerId, body.getPartnerId(), body.getOverrideNote(), newLines);
            if (updated == null) {
                return ServiceResponseDirector.errorBadRequest("Draft update failed (maybe already posted or cancelled).");
            }

            DispatchResponseDTO dto = mapper.toResponse(updated);
            dto.setStatus(DispatchStatusEnum.DRAFT.name());
            return ServiceResponseDirector.successOk(dto, "Draft dispatch updated.");

        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to update dispatch note: " + safeMsg(e));
        }
    }

    private String validateReferences(DispatchRequestDTO r, Long warehouseId, int idx) throws SQLException {
        if (warehouseId == null) {
            return REQ_PREFIX + idx + "]: cannot resolve warehouse for documentId=" + r.getDocumentId();
        }
        if (!slotRepo.existsForWarehouse(r.getDocumentId(), warehouseId)) {
            return REQ_PREFIX + idx + "]: unknown (documentId, warehouseId)=(" + r.getDocumentId() + "," + warehouseId + ")";
        }
        if (partnerRepo.isMissingOrInactive(r.getPartnerId())) {
            return REQ_PREFIX + idx + "]: partner not found or inactive: " + r.getPartnerId();
        }
        if (r.getItems() == null || r.getItems().isEmpty()) {
            return REQ_PREFIX + idx + "]: items missing.";
        }
        for (DispatchRequestDTO.DispatchItemRequest it : r.getItems()) {
            if (it.getItemId() == null) {
                return REQ_PREFIX + idx + "]: itemId missing.";
            }
            if (itemRepo.isMissingOrInactive(it.getItemId())) {
                return REQ_PREFIX + idx + "]: item not found or inactive: " + it.getItemId();
            }
        }
        return null;
    }

    private static String validateItemAttrsPresent(DispatchRequestDTO req, Map<Long, DocumentItemAttributesView> attrsByItem, int idx) {
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
            Long pdvId,
            Long korisnikId
    ) {
        List<DocumentItemLineDTO> out = new ArrayList<>(req.getItems().size());
        long br = 1;
        for (DispatchRequestDTO.DispatchItemRequest it : req.getItems()) {
            DocumentItemAttributesView a = attrsByItem.get(it.getItemId());
            out.add(DocumentItemLineDTO.builder()
                    .itemId(it.getItemId())
                    .quantity(BigDecimal.valueOf(it.getQuantity()))
                    .nameId(a.getNameId())
                    .unitOfMeasureId(a.getUnitOfMeasureId())
                    .valueAddedTaxId(pdvId)
                    .lineNumber(br++)
                    .build());
        }
        return out;
    }

    private static String safeMsg(Exception e) {
        String m = e.getMessage();
        return (m == null || m.isBlank()) ? e.getClass().getSimpleName() : m;
    }
}
