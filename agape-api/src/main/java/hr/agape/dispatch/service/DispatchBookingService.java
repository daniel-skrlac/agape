package hr.agape.dispatch.service;

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
import hr.agape.document.domain.DocumentItemPriceEntity;
import hr.agape.document.dto.DocumentItemLineDTO;
import hr.agape.document.lookup.repository.DocumentItemLookupRepository;
import hr.agape.document.lookup.repository.VatCategoryRepository;
import hr.agape.document.lookup.view.DocumentItemAttributesView;
import hr.agape.document.repository.DocumentHeaderRepository;
import hr.agape.document.repository.DocumentItemPriceRepository;
import hr.agape.document.repository.DocumentItemRepository;
import hr.agape.document.repository.DocumentSlotRepository;
import hr.agape.document.user.repository.UserRepository;
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
    private final DocumentHeaderRepository headerRepo;
    private final DispatchApiMapper mapper;
    private final PartnerRepository partnerRepo;
    private final DocumentItemRepository itemRepo;
    private final DocumentItemLookupRepository itemAttrsRepo;
    private final DocumentItemPriceRepository itemPriceRepo;
    private final VatCategoryRepository vatRepo;
    private final AuthUtil authUtil;
    private final DispatchBookingTransactionService tx;
    private final UserRepository userRepo;

    @Inject
    public DispatchBookingService(
            DocumentSlotRepository slotRepo,
            DocumentHeaderRepository headerRepo,
            DispatchApiMapper mapper,
            PartnerRepository partnerRepo,
            DocumentItemRepository itemRepo,
            DocumentItemLookupRepository itemAttrsRepo,
            DocumentItemPriceRepository itemPriceRepo,
            VatCategoryRepository vatRepo,
            AuthUtil authUtil,
            DispatchBookingTransactionService tx,
            UserRepository userRepo
    ) {
        this.slotRepo = slotRepo;
        this.headerRepo = headerRepo;
        this.mapper = mapper;
        this.partnerRepo = partnerRepo;
        this.itemRepo = itemRepo;
        this.itemAttrsRepo = itemAttrsRepo;
        this.itemPriceRepo = itemPriceRepo;
        this.vatRepo = vatRepo;
        this.authUtil = authUtil;
        this.tx = tx;
        this.userRepo = userRepo;
    }

    @Deprecated
    public ServiceResponseDTO<DispatchResponseDTO> bookOne(DispatchRequestDTO req) {
        try {
            Long actorOibNum = authUtil.requireOibAsLong();
            String actorOibDigits = authUtil.requireOibDigits();

            var user = userRepo.findByOib();
            if (user == null) {
                return ServiceResponseDirector.errorBadRequest("No KORISNIK found");
            }

            req.setCreatedBy(actorOibNum);

            Long whId = req.getWarehouseId();
            Long documentId = slotRepo.resolveDispatchDocumentIdForWarehouse(whId);
            if (documentId == null) {
                return ServiceResponseDirector.errorBadRequest(REQ_PREFIX + "0]: cannot resolve DOKUMENT_ID for warehouseId=" + whId);
            }
            req.setDocumentId(documentId);

            String err = validateReferences(req, whId, documentId, 0);
            if (err != null) return ServiceResponseDirector.errorBadRequest(err);

            Set<Long> itemIds = req.getItems().stream()
                    .map(DispatchRequestDTO.DispatchItemRequest::getItemId)
                    .collect(Collectors.toSet());

            Map<Long, DocumentItemAttributesView> attrsByItem = itemAttrsRepo.findAttributes(itemIds);
            err = validateItemAttrsPresent(req, attrsByItem, 0);
            if (err != null) return ServiceResponseDirector.errorBadRequest(err);

            Map<Long, Long> pdvByItem = resolvePdvByItemOrError(itemIds, user.getUserId());
            if (pdvByItem == null) {
                return ServiceResponseDirector.errorBadRequest(REQ_PREFIX + "0]: missing PDV in SKL_ACIJENE or inactive PDV in SIFREPDV.");
            }

            DocumentHeaderEntity headerInput = mapper.toHeader(req);
            headerInput.setTextType(DocumentTextType.OTPREMNICA);
            headerInput.setItemCount(req.getItems().size());

            List<DocumentItemLineDTO> prepared = prepareLines(req, attrsByItem, pdvByItem);

            DocumentHeaderEntity created = tx.createDraft(headerInput, prepared);

            if (req.isDraft()) {
                DocumentHeaderEntity fresh = headerRepo.findHeader(created.getId());
                DispatchResponseDTO out = mapper.toResponse(fresh);
                out.setStatus(DispatchStatusEnum.DRAFT.name());
                return ServiceResponseDirector.successOk(out, "Dispatch note saved as DRAFT.");
            }

            tx.postViaProcedure(created, actorOibDigits);

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

    public ServiceResponseDTO<DispatchBulkResponseDTO> bookBulk(List<DispatchRequestDTO> requests) {
        try {
            Long actorOibNum = authUtil.requireOibAsLong();
            String actorOibDigits = authUtil.requireOibDigits();

            var user = userRepo.findByOib();
            if (user == null) {
                return ServiceResponseDirector.errorBadRequest("No KORISNIK found.");
            }

            List<DispatchBulkItemResultDTO> results = new ArrayList<>(requests.size());

            List<Long> docByIdx = new ArrayList<>(requests.size());
            List<Long> whByIdx = new ArrayList<>(requests.size());

            for (DispatchRequestDTO r : requests) {
                Long whId = (r == null) ? null : r.getWarehouseId();
                whByIdx.add(whId);

                if (r != null) {
                    r.setCreatedBy(actorOibNum);
                }

                Long docId = (whId == null) ? null : slotRepo.resolveDispatchDocumentIdForWarehouse(whId);
                docByIdx.add(docId);

                if (r != null) r.setDocumentId(docId);
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

            Map<Long, Long> pdvByItemGlobal = allItemIds.isEmpty()
                    ? Map.of()
                    : resolvePdvByItemOrThrow(allItemIds, user.getUserId());
            int postedCount = 0, draftCount = 0, successCount = 0, failCount = 0;

            for (int i = 0; i < requests.size(); i++) {
                DispatchRequestDTO req = requests.get(i);
                Long whId = whByIdx.get(i);
                Long documentId = docByIdx.get(i);

                var rb = DispatchBulkItemResultDTO.builder()
                        .index(i)
                        .documentId(documentId)
                        .partnerId(req != null ? req.getPartnerId() : null)
                        .requestedDraft(req != null && req.isDraft());

                try {
                    if (req == null) {
                        failCount++;
                        results.add(rb.success(false).status(DispatchStatusEnum.FAILED.name()).error(REQ_PREFIX + i + "]: request is null").build());
                        continue;
                    }

                    if (whId == null) {
                        failCount++;
                        results.add(rb.success(false).status(DispatchStatusEnum.FAILED.name()).error(REQ_PREFIX + i + "]: warehouseId missing").build());
                        continue;
                    }

                    if (documentId == null) {
                        failCount++;
                        results.add(rb.success(false).status(DispatchStatusEnum.FAILED.name())
                                .error(REQ_PREFIX + i + "]: cannot resolve DOKUMENT_ID for warehouseId=" + whId + " (SD_SIFREZ/SD_SIFREG).")
                                .build());
                        continue;
                    }

                    String refErr = validateReferences(req, whId, documentId, i);
                    if (refErr != null) {
                        failCount++;
                        results.add(rb.success(false).status(DispatchStatusEnum.FAILED.name()).error(refErr).build());
                        continue;
                    }

                    String attrErr = validateItemAttrsPresent(req, attrsByItem, i);
                    if (attrErr != null) {
                        failCount++;
                        results.add(rb.success(false).status(DispatchStatusEnum.FAILED.name()).error(attrErr).build());
                        continue;
                    }

                    String pdvErr = validatePdvPresentAndActive(req, pdvByItemGlobal, user.getUserId(), i);
                    if (pdvErr != null) {
                        failCount++;
                        results.add(rb.success(false).status(DispatchStatusEnum.FAILED.name()).error(pdvErr).build());
                        continue;
                    }

                    DocumentHeaderEntity headerInput = mapper.toHeader(req);
                    headerInput.setTextType(DocumentTextType.OTPREMNICA);
                    headerInput.setItemCount(req.getItems().size());

                    List<DocumentItemLineDTO> prepared = prepareLines(req, attrsByItem, pdvByItemGlobal);

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
                        tx.postViaProcedure(created, actorOibDigits);
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

                // already cancelled -> keep same behavior
                if (existing.getCancelledBy() != null) {
                    return ServiceResponseDirector.errorBadRequest("Cannot cancel: already CANCELLED.");
                }

                // POSTED -> storno procedure (existing behavior)
                if (Boolean.TRUE.equals(existing.getPosted())) {
                    tx.cancelViaProcedure(headerId, body.getCancelReason());

                    DocumentHeaderEntity cancelled = headerRepo.findHeader(headerId);
                    if (cancelled == null || cancelled.getCancelledBy() == null) {
                        return ServiceResponseDirector.errorBadRequest("Cancel procedure did not mark document as cancelled. Check Oracle logs.");
                    }

                    DispatchResponseDTO dto = mapper.toResponse(cancelled);
                    dto.setStatus(DispatchStatusEnum.CANCELLED.name());
                    return ServiceResponseDirector.successOk(dto, "Dispatch cancelled (storno).");
                }

                // DRAFT -> delete records (no procedure)
                boolean deleted = tx.deleteDraft(headerId);
                if (!deleted) {
                    // can happen if concurrently posted/cancelled or already removed
                    return ServiceResponseDirector.errorBadRequest("Cannot cancel: dispatch is not a deletable DRAFT anymore.");
                }

                DispatchResponseDTO dto = mapper.toResponse(existing);
                dto.setStatus(DispatchStatusEnum.DELETED.name()); // or DRAFT if you don't have DELETED
                return ServiceResponseDirector.successOk(dto, "Draft dispatch deleted.");
            }

            if (body.isPostNow()) {
                if (Boolean.TRUE.equals(existing.getPosted())) {
                    return ServiceResponseDirector.errorBadRequest("Already POSTED.");
                }
                if (existing.getCancelledBy() != null) {
                    return ServiceResponseDirector.errorBadRequest("Cannot post: dispatch CANCELLED.");
                }

                tx.postViaProcedure(existing, actorOibDigits);

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

            // we can keep this legacy resolution for updates (existing doc already has documentId)
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

            // PDV per item from SKL_ACIJENE (not config map)
            Map<Long, Long> pdvByItem = resolvePdvByItemOrError(itemIds, user.getUserId());
            if (pdvByItem == null) {
                return ServiceResponseDirector.errorBadRequest("Missing PDV in SKL_ACIJENE or inactive PDV in SIFREPDV for one of items.");
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

                Long pdvId = pdvByItem.get(p.getItemId());
                if (pdvId == null) {
                    return ServiceResponseDirector.errorBadRequest("Missing PDV_ID in SKL_ACIJENE for itemId=" + p.getItemId());
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

    // -------------------- FIXED VALIDATION / HELPERS --------------------

    private String validateReferences(DispatchRequestDTO r, Long warehouseId, Long documentId, int idx) throws SQLException {
        if (warehouseId == null) {
            return REQ_PREFIX + idx + "]: warehouseId missing.";
        }
        if (documentId == null) {
            return REQ_PREFIX + idx + "]: cannot resolve DOKUMENT_ID for warehouseId=" + warehouseId + " (SD_SIFREZ/SD_SIFREG).";
        }

        // optional extra sanity: mapping exists (should be true by definition if resolved)
        if (!slotRepo.existsForWarehouse(documentId, warehouseId)) {
            return REQ_PREFIX + idx + "]: unknown mapping (documentId, warehouseId)=(" + documentId + "," + warehouseId + ")";
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

    /**
     * Resolve PDV per item from SKL_ACIJENE and validate PDV is active in SIFREPDV for the user.
     * Returns null on any error so caller can return a clean message.
     */
    private Map<Long, Long> resolvePdvByItemOrError(Set<Long> itemIds, long korisnikId) {
        try {
            List<DocumentItemPriceEntity> prices = itemPriceRepo.findPrices(itemIds);

            Map<Long, Long> pdvByItem = new HashMap<>(itemIds.size());
            for (DocumentItemPriceEntity p : prices) {
                if (p == null || p.getItemId() == null) continue;
                pdvByItem.put(p.getItemId(), p.getPdvId());
            }

            // ensure every item has PDV and it's active for user
            for (Long itemId : itemIds) {
                Long pdvId = pdvByItem.get(itemId);
                if (pdvId == null) return null;
                if (!vatRepo.existsActiveSifrepdv(korisnikId, pdvId)) return null;
            }

            return pdvByItem;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Same as resolvePdvByItemOrError, but throws - used in bulk global preload.
     */
    private Map<Long, Long> resolvePdvByItemOrThrow(Set<Long> itemIds, long korisnikId) throws SQLException {
        List<DocumentItemPriceEntity> prices = itemPriceRepo.findPrices(itemIds);

        Map<Long, Long> pdvByItem = new HashMap<>(itemIds.size());
        for (DocumentItemPriceEntity p : prices) {
            if (p == null || p.getItemId() == null) continue;
            pdvByItem.put(p.getItemId(), p.getPdvId());
        }

        for (Long itemId : itemIds) {
            Long pdvId = pdvByItem.get(itemId);
            if (pdvId == null) {
                throw new SQLException("Missing PDV_ID in SKL_ACIJENE for itemId=" + itemId);
            }
            if (!vatRepo.existsActiveSifrepdv(korisnikId, pdvId)) {
                throw new SQLException("Inactive PDV_ID in SIFREPDV for korisnikId=" + korisnikId + ", pdvId=" + pdvId);
            }
        }
        return pdvByItem;
    }

    private String validatePdvPresentAndActive(
            DispatchRequestDTO req,
            Map<Long, Long> pdvByItem,
            long korisnikId,
            int idx
    ) throws SQLException {
        for (DispatchRequestDTO.DispatchItemRequest it : req.getItems()) {
            Long pdvId = pdvByItem.get(it.getItemId());
            if (pdvId == null) {
                return REQ_PREFIX + idx + "]: missing PDV_ID in SKL_ACIJENE for itemId=" + it.getItemId();
            }
            if (!vatRepo.existsActiveSifrepdv(korisnikId, pdvId)) {
                return REQ_PREFIX + idx + "]: PDV_ID not active for korisnikId=" + korisnikId + " pdvId=" + pdvId + " (itemId=" + it.getItemId() + ")";
            }
        }
        return null;
    }

    private static List<DocumentItemLineDTO> prepareLines(
            DispatchRequestDTO req,
            Map<Long, DocumentItemAttributesView> attrsByItem,
            Map<Long, Long> pdvByItem
    ) {
        List<DocumentItemLineDTO> out = new ArrayList<>(req.getItems().size());
        long br = 1;

        for (DispatchRequestDTO.DispatchItemRequest it : req.getItems()) {
            DocumentItemAttributesView a = attrsByItem.get(it.getItemId());
            Long pdvId = pdvByItem.get(it.getItemId());

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
