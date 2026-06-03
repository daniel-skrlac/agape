package hr.agape.template.service;

import com.fasterxml.jackson.core.type.TypeReference;
import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.common.util.JsonUtil;
import hr.agape.dispatch.dto.DispatchBulkResponseDTO;
import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanEntryUpsertRequestDTO;
import hr.agape.dispatch.scan.util.BookingSessionScanEntryUtil;
import hr.agape.dispatch.service.DispatchBookingService;
import hr.agape.item.dto.ItemDescriptorResponseDTO;
import hr.agape.item.service.ItemDirectoryService;
import hr.agape.partner.dto.PartnerResponseDTO;
import hr.agape.partner.service.PartnerService;
import hr.agape.template.domain.DispatchBookingSessionEntity;
import hr.agape.template.domain.DispatchBookingSessionEntryEntity;
import hr.agape.template.domain.DispatchTemplateEntity;
import hr.agape.template.dto.BookingSessionCreateRequestDTO;
import hr.agape.template.dto.BookingSessionEntryResponseDTO;
import hr.agape.template.dto.BookingSessionEntryUpsertRequestDTO;
import hr.agape.template.dto.BookingSessionResponseDTO;
import hr.agape.template.dto.BookingSessionsQueryDTO;
import hr.agape.template.dto.TemplateBookDocPatchDTO;
import hr.agape.template.dto.TemplateBookItemDTO;
import hr.agape.template.enumeration.BookingSessionStatus;
import hr.agape.template.integration.TemplateBookingRequestBuilder;
import hr.agape.template.mapper.BookingSessionMapper;
import hr.agape.template.repository.DispatchBookingSessionEntryRepository;
import hr.agape.template.repository.DispatchBookingSessionRepository;
import hr.agape.template.repository.DispatchTemplateRepository;
import hr.agape.user.domain.UserEntity;
import hr.agape.user.repository.UserRepository;
import hr.agape.user.util.AuthUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import static hr.agape.common.util.DateTimeUtil.ZAGREB;

@ApplicationScoped
public class DispatchBookingSessionService {

    private final AuthUtil authUtil;
    private final JsonUtil jsonUtil;

    private final UserRepository userRepo;

    private final DispatchBookingSessionRepository sessionRepo;
    private final DispatchBookingSessionEntryRepository entryRepo;

    private final DispatchTemplateRepository templateRepo;

    private final TemplateBookingRequestBuilder bookingRequestBuilder;

    private final DispatchBookingService oracleBooking;
    private final BookingSessionMapper mapper;

    private final PartnerService partnerService;
    private final ItemDirectoryService itemDirectoryService;

    @Inject
    public DispatchBookingSessionService(
            AuthUtil authUtil, JsonUtil jsonUtil,
            UserRepository userRepo,
            DispatchBookingSessionRepository sessionRepo,
            DispatchBookingSessionEntryRepository entryRepo,
            DispatchTemplateRepository templateRepo, TemplateBookingRequestBuilder bookingRequestBuilder,
            DispatchBookingService oracleBooking,
            BookingSessionMapper mapper, PartnerService partnerService,
            ItemDirectoryService itemDirectoryService
    ) {
        this.authUtil = authUtil;
        this.jsonUtil = jsonUtil;
        this.userRepo = userRepo;
        this.sessionRepo = sessionRepo;
        this.entryRepo = entryRepo;
        this.templateRepo = templateRepo;
        this.bookingRequestBuilder = bookingRequestBuilder;
        this.oracleBooking = oracleBooking;
        this.mapper = mapper;
        this.partnerService = partnerService;
        this.itemDirectoryService = itemDirectoryService;
    }

    public ServiceResponseDTO<PagedResultDTO<BookingSessionResponseDTO>> listSessions(BookingSessionsQueryDTO q) {
        try {
            Long userId = authUtil.requireUserId();

            int page = (q == null) ? 0 : Math.max(0, q.getPage());
            int size = (q == null) ? 10 : q.getSize();

            BookingSessionStatus status = null;
            String statusRaw = (q == null) ? null : q.getStatus();

            if (statusRaw != null && !statusRaw.isBlank() && !"ALL".equalsIgnoreCase(statusRaw.trim())) {
                try {
                    status = BookingSessionStatus.valueOf(statusRaw.trim().toUpperCase());
                } catch (Exception e) {
                    return ServiceResponseDirector.errorBadRequest("Invalid status: " + statusRaw);
                }
            }

            String search = (q == null) ? null : q.getQ();
            if (search != null) {
                search = search.trim();
                if (search.isBlank()) search = null;
            }

            var dateFrom = (q == null) ? null : q.getDateFrom();
            var dateTo = (q == null) ? null : q.getDateTo();

            if (dateFrom != null && dateTo != null && dateFrom.isAfter(dateTo)) {
                return ServiceResponseDirector.errorBadRequest("dateFrom cannot be after dateTo.");
            }

            OffsetDateTime createdFrom = null;
            OffsetDateTime createdToExclusive = null;

            if (dateFrom != null) {
                createdFrom = dateFrom.atStartOfDay(ZAGREB).toOffsetDateTime();
            }
            if (dateTo != null) {
                createdToExclusive = dateTo.plusDays(1).atStartOfDay(ZAGREB).toOffsetDateTime();
            }

            long total = sessionRepo.countForOwnerFiltered(
                    userId,
                    status,
                    search,
                    createdFrom,
                    createdToExclusive
            );

            List<DispatchBookingSessionEntity> list = sessionRepo.pageForOwnerFiltered(
                    userId,
                    status,
                    search,
                    createdFrom,
                    createdToExclusive,
                    page,
                    size
            );

            List<BookingSessionResponseDTO> items = list.stream()
                    .map(s -> {
                        BookingSessionResponseDTO dto = mapper.toDto(s);
                        dto.setEntries(null);
                        return dto;
                    })
                    .toList();

            PagedResultDTO<BookingSessionResponseDTO> result = PagedResultDTO.<BookingSessionResponseDTO>builder()
                    .items(items)
                    .page(page)
                    .size(size)
                    .total(total)
                    .build();

            return ServiceResponseDirector.successOk(result, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to list sessions.");
        }
    }

    @Transactional
    public ServiceResponseDTO<BookingSessionResponseDTO> createSession(BookingSessionCreateRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            UserEntity me = userRepo.findById(userId);
            if (me == null) return ServiceResponseDirector.errorUnauthorized("Invalid user.");

            DispatchBookingSessionEntity s = new DispatchBookingSessionEntity();
            s.setOwner(me);
            s.setTitle(req.getTitle().trim());
            s.setNote(req.getNote());
            s.setWarehouseId(req.getWarehouseId());
            s.setStatus(BookingSessionStatus.DRAFT);

            s.persist();

            BookingSessionResponseDTO dto = mapper.toDto(s);
            dto.setEntries(List.of());
            return ServiceResponseDirector.successOk(dto, "Session created.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to create session.");
        }
    }

    public ServiceResponseDTO<BookingSessionResponseDTO> getSession(Long sessionId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity s = sessionRepo.findOwned(sessionId, userId);
            if (s == null) return ServiceResponseDirector.errorNotFound("Session not found.");

            List<DispatchBookingSessionEntryEntity> entries = entryRepo.listForSession(sessionId);

            BookingSessionResponseDTO dto = mapper.toDto(s);
            dto.setEntries(toEntryDtosWithPartnerMeta(entries));

            return ServiceResponseDirector.successOk(dto, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to fetch session.");
        }
    }

    @Transactional
    public ServiceResponseDTO<Void> deleteSession(Long sessionId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity s = sessionRepo.findOwned(sessionId, userId);
            if (s == null) return ServiceResponseDirector.errorNotFound("Session not found.");

            if (s.getStatus() != BookingSessionStatus.DRAFT) {
                return ServiceResponseDirector.errorBadRequest("Session cannot be deleted.");
            }

            entryRepo.deleteForSession(sessionId);

            s.delete();

            return ServiceResponseDirector.successOk(null, "Session deleted.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to delete session.");
        }
    }

    @Transactional
    public ServiceResponseDTO<BookingSessionEntryResponseDTO> upsertEntry(Long sessionId, BookingSessionEntryUpsertRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity s = sessionRepo.findOwned(sessionId, userId);
            if (s == null) return ServiceResponseDirector.errorNotFound("Session not found.");
            if (s.getStatus() != BookingSessionStatus.DRAFT)
                return ServiceResponseDirector.errorBadRequest("Session is not editable.");

            if (req.getTemplateId() != null) {
                DispatchTemplateEntity t = templateRepo.findFullAccessible(req.getTemplateId(), userId);
                if (t == null) return ServiceResponseDirector.errorBadRequest("Template not accessible.");
            }

            if (req.getTemplateId() == null && isBlankItems(req.getExtraItems())) {
                return ServiceResponseDirector.errorBadRequest("Template or standalone items are required.");
            }

            DispatchBookingSessionEntryEntity e = entryRepo.findBySessionAndPartner(sessionId, req.getPartnerId());
            if (e == null) {
                e = new DispatchBookingSessionEntryEntity();
                e.setBookingSession(s);
                e.setPartnerId(req.getPartnerId());
            }

            e.setTemplateId(req.getTemplateId());
            e.setDraftMode(req.getDraftMode());
            e.setNote(req.getNote());
            e.setDocumentDate(req.getDocumentDate());

            e.setDocPatchesJson(jsonUtil.write(req.getDocPatches() == null ? List.of() : req.getDocPatches()));
            e.setExtraItemsJson(jsonUtil.write(req.getExtraItems() == null ? List.of() : req.getExtraItems()));

            e.persist();

            return ServiceResponseDirector.successOk(mapper.toDto(e), "Entry saved.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to save entry.");
        }
    }

    @Transactional
    public ServiceResponseDTO<BookingSessionEntryResponseDTO> upsertScanEntry(
            Long sessionId,
            BookingSessionScanEntryUpsertRequestDTO req
    ) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity s = sessionRepo.findOwned(sessionId, userId);
            if (s == null) return ServiceResponseDirector.errorNotFound("Session not found.");
            if (s.getStatus() != BookingSessionStatus.DRAFT) {
                return ServiceResponseDirector.errorBadRequest("Session is not editable.");
            }

            BookingSessionEntryUpsertRequestDTO entryReq = BookingSessionScanEntryUtil.toEntryRequest(
                    req,
                    resolveScanNote(req.getNote())
            );

            if (entryReq.getTemplateId() != null) {
                DispatchTemplateEntity t = templateRepo.findFullAccessible(entryReq.getTemplateId(), userId);
                if (t == null) return ServiceResponseDirector.errorBadRequest("Template not accessible.");
            }

            if (entryReq.getTemplateId() == null && isBlankItems(entryReq.getExtraItems())) {
                return ServiceResponseDirector.errorBadRequest("Sken nije pronašao stavke za spremanje.");
            }

            String scanFingerprint = buildScanFingerprint(entryReq);
            DispatchBookingSessionEntryEntity e = entryRepo.findBySessionAndPartner(sessionId, entryReq.getPartnerId());
            if (e == null) {
                e = new DispatchBookingSessionEntryEntity();
                e.setBookingSession(s);
                e.setPartnerId(entryReq.getPartnerId());
                e.setTemplateId(entryReq.getTemplateId());
                e.setDraftMode(entryReq.getDraftMode());
                e.setNote(entryReq.getNote());
                e.setDocumentDate(entryReq.getDocumentDate());
                e.setDocPatchesJson(jsonUtil.write(entryReq.getDocPatches() == null ? List.of() : entryReq.getDocPatches()));
                e.setExtraItemsJson(jsonUtil.write(entryReq.getExtraItems() == null ? List.of() : entryReq.getExtraItems()));
                e.setScanFingerprintsJson(jsonUtil.write(scanFingerprint == null ? List.of() : List.of(scanFingerprint)));
                e.persist();

                return ServiceResponseDirector.successOk(enrichedEntryDto(e), "Entry saved.");
            }

            if (scanFingerprint != null
                    && (hasScanFingerprint(e, scanFingerprint) || scanFingerprint.equals(buildExistingScanFingerprint(e)))) {
                return ServiceResponseDirector.successOk(enrichedEntryDto(e), "Entry saved.");
            }

            mergeScanIntoExistingEntry(e, entryReq);
            appendScanFingerprint(e, scanFingerprint);
            e.persist();

            return ServiceResponseDirector.successOk(enrichedEntryDto(e), "Entry saved.");
        } catch (IllegalArgumentException e) {
            return ServiceResponseDirector.errorBadRequest(e.getMessage());
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to save scan entry: " + e.getMessage());
        }
    }

    private String resolveScanNote(String note) {
        if (note != null && !note.isBlank()) {
            return note.trim();
        }

        return "Skenirano sa papira";
    }

    private BookingSessionEntryResponseDTO enrichedEntryDto(DispatchBookingSessionEntryEntity entry) {
        return toEntryDtosWithPartnerMeta(List.of(entry)).getFirst();
    }

    private boolean hasScanFingerprint(DispatchBookingSessionEntryEntity entry, String scanFingerprint) {
        if (scanFingerprint == null || scanFingerprint.isBlank()) return false;

        List<String> existing = jsonUtil.readList(entry.getScanFingerprintsJson(), new TypeReference<>() {});
        return existing.stream().anyMatch(scanFingerprint::equals);
    }

    private void appendScanFingerprint(DispatchBookingSessionEntryEntity entry, String scanFingerprint) {
        if (scanFingerprint == null || scanFingerprint.isBlank()) return;

        List<String> existing = new ArrayList<>(jsonUtil.readList(entry.getScanFingerprintsJson(), new TypeReference<>() {}));
        if (!existing.contains(scanFingerprint)) {
            existing.add(scanFingerprint);
        }
        entry.setScanFingerprintsJson(jsonUtil.write(existing));
    }

    private String buildScanFingerprint(BookingSessionEntryUpsertRequestDTO req) {
        if (req == null) return null;

        StringBuilder sb = new StringBuilder();
        sb.append("partner=").append(req.getPartnerId()).append('|');
        sb.append("template=").append(req.getTemplateId()).append('|');
        sb.append("date=").append(req.getDocumentDate()).append('|');

        List<String> lines = new ArrayList<>();
        for (TemplateBookDocPatchDTO patch : req.getDocPatches() == null ? List.<TemplateBookDocPatchDTO>of() : req.getDocPatches()) {
            if (patch == null || patch.getDocumentId() == null) continue;
            collectFingerprintItems(lines, "D:" + patch.getDocumentId(), patch.getSetItems());
            collectFingerprintItems(lines, "D:" + patch.getDocumentId(), patch.getAddItems());
        }
        collectFingerprintItems(lines, "E", req.getExtraItems());

        if (lines.isEmpty()) return null;

        lines.sort(Comparator.naturalOrder());
        for (String line : lines) {
            sb.append(line).append('|');
        }

        return sha256Hex(sb.toString());
    }

    private String buildExistingScanFingerprint(DispatchBookingSessionEntryEntity entry) {
        if (entry == null) return null;

        BookingSessionEntryUpsertRequestDTO req = new BookingSessionEntryUpsertRequestDTO();
        req.setPartnerId(entry.getPartnerId());
        req.setTemplateId(entry.getTemplateId());
        req.setDocumentDate(entry.getDocumentDate());
        req.setDocPatches(jsonUtil.readList(entry.getDocPatchesJson(), new TypeReference<>() {}));
        req.setExtraItems(jsonUtil.readList(entry.getExtraItemsJson(), new TypeReference<>() {}));

        return buildScanFingerprint(req);
    }

    private void collectFingerprintItems(List<String> out, String scope, List<TemplateBookItemDTO> items) {
        for (TemplateBookItemDTO item : items == null ? List.<TemplateBookItemDTO>of() : items) {
            if (item == null
                    || item.getItemId() == null
                    || item.getQuantity() == null
                    || item.getQuantity().signum() <= 0) {
                continue;
            }
            out.add(scope + ':' + item.getItemId() + ':' + normalizeQuantity(item.getQuantity()));
        }
    }

    private String normalizeQuantity(BigDecimal quantity) {
        return quantity.stripTrailingZeros().toPlainString();
    }

    private String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            return Integer.toHexString(input.hashCode());
        }
    }

    private void mergeScanIntoExistingEntry(
            DispatchBookingSessionEntryEntity existing,
            BookingSessionEntryUpsertRequestDTO incoming
    ) {
        Long existingTemplateId = existing.getTemplateId();
        Long incomingTemplateId = incoming.getTemplateId();

        if (existingTemplateId != null
                && incomingTemplateId != null
                && !existingTemplateId.equals(incomingTemplateId)) {
            throw new IllegalArgumentException(
                    "Partner već ima unos s drugim predloškom. Otvori unos partnera i uredi ga ručno."
            );
        }

        existing.setTemplateId(existingTemplateId != null ? existingTemplateId : incomingTemplateId);

        if (incoming.getDraftMode() != null) {
            existing.setDraftMode(incoming.getDraftMode());
        }

        if (existing.getDocumentDate() == null && incoming.getDocumentDate() != null) {
            existing.setDocumentDate(incoming.getDocumentDate());
        }

        existing.setNote(mergeNotes(existing.getNote(), incoming.getNote()));

        List<TemplateBookDocPatchDTO> mergedPatches = mergeDocPatches(
                jsonUtil.readList(existing.getDocPatchesJson(), new TypeReference<>() {}),
                incoming.getDocPatches()
        );
        List<TemplateBookItemDTO> mergedExtraItems = mergeExtraItems(
                jsonUtil.readList(existing.getExtraItemsJson(), new TypeReference<>() {}),
                incoming.getExtraItems()
        );

        existing.setDocPatchesJson(jsonUtil.write(mergedPatches));
        existing.setExtraItemsJson(jsonUtil.write(mergedExtraItems));
    }

    private String mergeNotes(String existing, String incoming) {
        String a = existing == null ? "" : existing.trim();
        String b = incoming == null ? "" : incoming.trim();

        if (b.isBlank()) return a.isBlank() ? null : a;
        if (a.isBlank()) return b;
        if (a.equals(b) || a.contains(b)) return a;

        return a + "\n" + b;
    }

    private List<TemplateBookDocPatchDTO> mergeDocPatches(
            List<TemplateBookDocPatchDTO> existing,
            List<TemplateBookDocPatchDTO> incoming
    ) {
        Map<Long, Map<Long, TemplateBookItemDTO>> byDocumentAndItem = new LinkedHashMap<>();

        addDocPatches(byDocumentAndItem, existing);
        addDocPatches(byDocumentAndItem, incoming);

        List<TemplateBookDocPatchDTO> out = new ArrayList<>();
        for (Map.Entry<Long, Map<Long, TemplateBookItemDTO>> entry : byDocumentAndItem.entrySet()) {
            TemplateBookDocPatchDTO patch = new TemplateBookDocPatchDTO();
            patch.setDocumentId(entry.getKey());
            patch.setAddItems(new ArrayList<>(entry.getValue().values()));
            out.add(patch);
        }

        return out;
    }

    private void addDocPatches(
            Map<Long, Map<Long, TemplateBookItemDTO>> byDocumentAndItem,
            List<TemplateBookDocPatchDTO> patches
    ) {
        for (TemplateBookDocPatchDTO patch : patches == null ? List.<TemplateBookDocPatchDTO>of() : patches) {
            if (patch == null || patch.getDocumentId() == null) continue;

            Map<Long, TemplateBookItemDTO> byItem = byDocumentAndItem.computeIfAbsent(
                    patch.getDocumentId(),
                    key -> new LinkedHashMap<>()
            );

            for (TemplateBookItemDTO item : patch.getSetItems() == null ? List.<TemplateBookItemDTO>of() : patch.getSetItems()) {
                addItemQuantity(byItem, item);
            }

            for (TemplateBookItemDTO item : patch.getAddItems() == null ? List.<TemplateBookItemDTO>of() : patch.getAddItems()) {
                addItemQuantity(byItem, item);
            }
        }
    }

    private List<TemplateBookItemDTO> mergeExtraItems(
            List<TemplateBookItemDTO> existing,
            List<TemplateBookItemDTO> incoming
    ) {
        Map<Long, TemplateBookItemDTO> byItem = new LinkedHashMap<>();
        for (TemplateBookItemDTO item : existing == null ? List.<TemplateBookItemDTO>of() : existing) {
            addItemQuantity(byItem, item);
        }
        for (TemplateBookItemDTO item : incoming == null ? List.<TemplateBookItemDTO>of() : incoming) {
            addItemQuantity(byItem, item);
        }
        return new ArrayList<>(byItem.values());
    }

    private void addItemQuantity(Map<Long, TemplateBookItemDTO> byItem, TemplateBookItemDTO source) {
        if (source == null
                || source.getItemId() == null
                || source.getQuantity() == null
                || source.getQuantity().signum() <= 0) {
            return;
        }

        TemplateBookItemDTO item = byItem.computeIfAbsent(source.getItemId(), itemId -> {
            TemplateBookItemDTO next = new TemplateBookItemDTO();
            next.setItemId(itemId);
            next.setQuantity(BigDecimal.ZERO);
            return next;
        });

        item.setQuantity(item.getQuantity().add(source.getQuantity()));
    }

    @Transactional
    public ServiceResponseDTO<Void> removeEntry(Long sessionId, Long partnerId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity s = sessionRepo.findOwned(sessionId, userId);
            if (s == null) return ServiceResponseDirector.errorNotFound("Session not found.");
            if (s.getStatus() != BookingSessionStatus.DRAFT)
                return ServiceResponseDirector.errorBadRequest("Session is not editable.");

            DispatchBookingSessionEntryEntity e = entryRepo.findBySessionAndPartner(sessionId, partnerId);
            if (e == null) return ServiceResponseDirector.errorNotFound("Entry not found.");

            e.delete();
            return ServiceResponseDirector.successOk(null, "Entry removed.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to remove entry.");
        }
    }

    @Transactional(Transactional.TxType.NOT_SUPPORTED)
    public ServiceResponseDTO<DispatchBulkResponseDTO> finalizeSession(Long sessionId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity s = sessionRepo.findOwned(sessionId, userId);
            if (s == null) return ServiceResponseDirector.errorNotFound("Session not found.");
            if (s.getStatus() != BookingSessionStatus.DRAFT) {
                return ServiceResponseDirector.errorBadRequest("Session cannot be finalized.");
            }

            List<DispatchBookingSessionEntryEntity> entries = entryRepo.listForSession(sessionId);
            if (entries.isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("Session has no entries.");
            }

            List<Long> templateIds = entries.stream()
                    .map(DispatchBookingSessionEntryEntity::getTemplateId)
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();

            Map<Long, DispatchTemplateEntity> templateById = templateRepo
                    .listFullAccessibleByIds(userId, templateIds)
                    .stream()
                    .filter(t -> t.getId() != null)
                    .collect(Collectors.toMap(
                            DispatchTemplateEntity::getId,
                            t -> t
                    ));

            List<DispatchRequestDTO> allRequests = new ArrayList<>();

            for (DispatchBookingSessionEntryEntity e : entries) {
                List<TemplateBookItemDTO> extraItems = jsonUtil.readList(
                        e.getExtraItemsJson(),
                        new TypeReference<>() {}
                );

                if (e.getTemplateId() == null) {
                    if (isBlankItems(extraItems)) {
                        return ServiceResponseDirector.errorBadRequest("Entry has no template and no standalone items: partner " + e.getPartnerId());
                    }
                    allRequests.add(buildStandaloneRequest(s.getWarehouseId(), e, extraItems));
                    continue;
                }

                DispatchTemplateEntity t = templateById.get(e.getTemplateId());
                if (t == null) {
                    return ServiceResponseDirector.errorBadRequest("Template not accessible: " + e.getTemplateId());
                }
                if (t.getDocuments() == null || t.getDocuments().isEmpty()) {
                    return ServiceResponseDirector.errorBadRequest("Template has no documents: " + e.getTemplateId());
                }

                boolean draft = e.getDraftMode().asDraftFlag();

                List<TemplateBookDocPatchDTO> patches = jsonUtil.readList(
                        e.getDocPatchesJson(),
                        new TypeReference<>() {}
                );
                allRequests.addAll(
                        bookingRequestBuilder.buildRequestsForPartner(
                                s.getWarehouseId(),
                                e.getPartnerId(),
                                draft,
                                e.getDocumentDate(),
                                e.getNote(),
                                patches,
                                extraItems,
                                t
                        )
                );
            }

            ServiceResponseDTO<DispatchBulkResponseDTO> res = oracleBooking.bookBulk(allRequests);
            if (!res.isSuccess()) return res;

            persistFinalization(sessionId, userId, res.getData());

            return res;

        } catch (IllegalArgumentException e) {
            return ServiceResponseDirector.errorBadRequest(e.getMessage());
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to finalize session.");
        }
    }

    private boolean isBlankItems(List<TemplateBookItemDTO> items) {
        if (items == null || items.isEmpty()) return true;
        return items.stream().noneMatch(item ->
                item != null
                        && item.getItemId() != null
                        && item.getQuantity() != null
                        && item.getQuantity().signum() > 0
        );
    }

    private DispatchRequestDTO buildStandaloneRequest(
            Long warehouseId,
            DispatchBookingSessionEntryEntity entry,
            List<TemplateBookItemDTO> extraItems
    ) {
        DispatchRequestDTO request = new DispatchRequestDTO();
        request.setWarehouseId(warehouseId);
        request.setPartnerId(entry.getPartnerId());
        request.setDraft(entry.getDraftMode().asDraftFlag());
        request.setDocumentDate(entry.getDocumentDate());
        request.setNote(entry.getNote());

        List<DispatchRequestDTO.DispatchItemRequest> items = extraItems.stream()
                .filter(item -> item != null
                        && item.getItemId() != null
                        && item.getQuantity() != null
                        && item.getQuantity().signum() > 0)
                .map(item -> {
                    DispatchRequestDTO.DispatchItemRequest line = new DispatchRequestDTO.DispatchItemRequest();
                    line.setItemId(item.getItemId());
                    line.setQuantity(item.getQuantity().doubleValue());
                    return line;
                })
                .toList();
        request.setItems(items);
        return request;
    }

    @Transactional(Transactional.TxType.REQUIRES_NEW)
    void persistFinalization(Long sessionId, Long userId, DispatchBulkResponseDTO data) {
        DispatchBookingSessionEntity s = sessionRepo.findOwned(sessionId, userId);
        if (s == null) {
            return;
        }
        if (s.getStatus() != BookingSessionStatus.DRAFT) {
            return;
        }

        s.setStatus(BookingSessionStatus.FINALIZED);
        s.setFinalResultJson(jsonUtil.write(data));
        s.setFinalizedAt(OffsetDateTime.now(ZAGREB));
    }

    @Transactional
    public ServiceResponseDTO<Void> cancelSession(Long sessionId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity s = sessionRepo.findOwned(sessionId, userId);
            if (s == null) return ServiceResponseDirector.errorNotFound("Session not found.");
            if (s.getStatus() != BookingSessionStatus.DRAFT)
                return ServiceResponseDirector.errorBadRequest("Session cannot be cancelled.");

            s.setStatus(BookingSessionStatus.CANCELLED);
            return ServiceResponseDirector.successOk(null, "Session cancelled.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to cancel session.");
        }
    }

    private List<BookingSessionEntryResponseDTO> toEntryDtosWithPartnerMeta(
            List<DispatchBookingSessionEntryEntity> entries
    ) {
        if (entries == null || entries.isEmpty()) {
            return List.of();
        }

        List<Long> partnerIds = entries.stream()
                .map(DispatchBookingSessionEntryEntity::getPartnerId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        Map<Long, PartnerResponseDTO> partnerById = partnerService.findPartnersByIds(partnerIds);
        Map<Long, ItemDescriptorResponseDTO> itemById = itemDirectoryService.findItemsByIds(
                collectEntryItemIds(entries).stream().toList()
        );

        return entries.stream()
                .map(entry -> {
                    BookingSessionEntryResponseDTO dto = mapper.toDto(entry);

                    if (entry.getPartnerId() != null) {
                        PartnerResponseDTO partner = partnerById.get(entry.getPartnerId());
                        if (partner != null) {
                            dto.setPartnerName(partner.getName());
                        }
                    }

                    dto.setDocPatches(enrichItemMetadata(dto.getDocPatches(), itemById));
                    dto.setExtraItems(enrichItemMetadata(dto.getExtraItems(), itemById));

                    return dto;
                })
                .toList();
    }

    private Set<Long> collectEntryItemIds(List<DispatchBookingSessionEntryEntity> entries) {
        Set<Long> ids = new LinkedHashSet<>();

        for (DispatchBookingSessionEntryEntity entry : entries) {
            collectItemIds(jsonUtil.readObjectOrNull(entry.getDocPatchesJson()), ids);
            collectItemIds(jsonUtil.readObjectOrNull(entry.getExtraItemsJson()), ids);
        }

        return ids;
    }

    @SuppressWarnings("unchecked")
    private void collectItemIds(Object value, Set<Long> ids) {
        if (value == null) {
            return;
        }

        if (value instanceof List<?> list) {
            for (Object item : list) {
                collectItemIds(item, ids);
            }
            return;
        }

        if (!(value instanceof Map<?, ?> map)) {
            return;
        }

        Long itemId = toLong(firstPresent(
                map.get("itemId"),
                map.get("item_id"),
                map.get("id")
        ));

        if (itemId != null && itemId > 0) {
            ids.add(itemId);
        }

        Object addItems = firstPresent(
                map.get("addItems"),
                map.get("add_items"),
                map.get("setItems"),
                map.get("set_items"),
                map.get("items"),
                map.get("lines")
        );

        collectItemIds(addItems, ids);

        if (itemId == null) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                Long keyId = toLong(entry.getKey());
                if (keyId != null && keyId > 0 && !(entry.getValue() instanceof Map<?, ?>)) {
                    ids.add(keyId);
                }
            }
        }
    }

    private Object enrichItemMetadata(Object value, Map<Long, ItemDescriptorResponseDTO> itemById) {
        if (value == null || itemById == null || itemById.isEmpty()) {
            return value;
        }

        if (value instanceof List<?> list) {
            return list.stream()
                    .map(item -> enrichItemMetadata(item, itemById))
                    .toList();
        }

        if (!(value instanceof Map<?, ?> map)) {
            return value;
        }

        Map<String, Object> out = new LinkedHashMap<>();
        map.forEach((key, itemValue) -> out.put(String.valueOf(key), enrichItemMetadata(itemValue, itemById)));

        Long itemId = toLong(firstPresent(
                map.get("itemId"),
                map.get("item_id"),
                map.get("id")
        ));

        if (itemId != null && itemId > 0) {
            ItemDescriptorResponseDTO item = itemById.get(itemId);
            if (item != null) {
                out.putIfAbsent("itemId", item.getItemId());
                putIfPresent(out, "itemName", item.getName());
                putIfPresent(out, "name", item.getName());
                putIfPresent(out, "itemCode", item.getCode());
                putIfPresent(out, "code", item.getCode());
                putIfPresent(out, "unit", item.getUnit());
                putIfPresent(out, "barcode", item.getBarcode());
            }
        }

        return out;
    }

    private Object firstPresent(Object... values) {
        for (Object value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }

        try {
            if (value instanceof Number number) {
                return number.longValue();
            }

            String raw = String.valueOf(value).trim();
            if (raw.isBlank()) {
                return null;
            }

            return Long.valueOf(raw);
        } catch (Exception ignored) {
            return null;
        }
    }

    private void putIfPresent(Map<String, Object> out, String key, String value) {
        if (value != null && !value.isBlank()) {
            out.putIfAbsent(key, value);
        }
    }
}
