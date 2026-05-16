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

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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

    @Inject
    public DispatchBookingSessionService(
            AuthUtil authUtil, JsonUtil jsonUtil,
            UserRepository userRepo,
            DispatchBookingSessionRepository sessionRepo,
            DispatchBookingSessionEntryRepository entryRepo,
            DispatchTemplateRepository templateRepo, TemplateBookingRequestBuilder bookingRequestBuilder,
            DispatchBookingService oracleBooking,
            BookingSessionMapper mapper, PartnerService partnerService
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

            e.setDocPatchesJson(jsonUtil.write(req.getDocPatches() == null ? List.of() : req.getDocPatches()));
            e.setExtraItemsJson(jsonUtil.write(req.getExtraItems() == null ? List.of() : req.getExtraItems()));

            e.persist();

            return ServiceResponseDirector.successOk(mapper.toDto(e), "Entry saved.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to save entry.");
        }
    }

    public ServiceResponseDTO<BookingSessionEntryResponseDTO> upsertScanEntry(
            Long sessionId,
            BookingSessionScanEntryUpsertRequestDTO req
    ) {
        try {
            BookingSessionEntryUpsertRequestDTO entryReq = BookingSessionScanEntryUtil.toEntryRequest(
                    req,
                    resolveScanNote(req.getNote())
            );

            return upsertEntry(sessionId, entryReq);
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to save scan entry.");
        }
    }

    private String resolveScanNote(String note) {
        if (note != null && !note.isBlank()) {
            return note.trim();
        }

        return "Skenirano iz papirnate otpremnice";
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

        return entries.stream()
                .map(entry -> {
                    BookingSessionEntryResponseDTO dto = mapper.toDto(entry);

                    if (entry.getPartnerId() != null) {
                        PartnerResponseDTO partner = partnerById.get(entry.getPartnerId());
                        if (partner != null) {
                            dto.setPartnerName(partner.getName());
                        }
                    }

                    return dto;
                })
                .toList();
    }
}
