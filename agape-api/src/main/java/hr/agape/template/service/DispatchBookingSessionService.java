package hr.agape.template.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchBulkResponseDTO;
import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.service.DispatchBookingService;
import hr.agape.template.domain.DispatchBookingSessionEntity;
import hr.agape.template.domain.DispatchBookingSessionEntryEntity;
import hr.agape.template.domain.DispatchTemplateEntity;
import hr.agape.template.dto.BookingSessionCreateRequestDTO;
import hr.agape.template.dto.BookingSessionEntryResponseDTO;
import hr.agape.template.dto.BookingSessionEntryUpsertRequestDTO;
import hr.agape.template.dto.BookingSessionResponseDTO;
import hr.agape.template.dto.TemplateBookDocPatchDTO;
import hr.agape.template.dto.TemplateBookExtraDocDTO;
import hr.agape.template.dto.TemplateBookItemDTO;
import hr.agape.template.enumeration.BookingSessionStatus;
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

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class DispatchBookingSessionService {

    private static final ZoneId ZAGREB = ZoneId.of("Europe/Zagreb");

    private final AuthUtil authUtil;
    private final UserRepository userRepo;

    private final DispatchBookingSessionRepository sessionRepo;
    private final DispatchBookingSessionEntryRepository entryRepo;

    private final DispatchTemplateRepository templateRepo;

    private final DispatchBookingService oracleBooking;
    private final BookingSessionMapper mapper;
    private final ObjectMapper om;

    @Inject
    public DispatchBookingSessionService(
            AuthUtil authUtil,
            UserRepository userRepo,
            DispatchBookingSessionRepository sessionRepo,
            DispatchBookingSessionEntryRepository entryRepo,
            DispatchTemplateRepository templateRepo,
            DispatchBookingService oracleBooking,
            BookingSessionMapper mapper,
            ObjectMapper om
    ) {
        this.authUtil = authUtil;
        this.userRepo = userRepo;
        this.sessionRepo = sessionRepo;
        this.entryRepo = entryRepo;
        this.templateRepo = templateRepo;
        this.oracleBooking = oracleBooking;
        this.mapper = mapper;
        this.om = om;
    }

    public ServiceResponseDTO<List<BookingSessionResponseDTO>> listSessions(String statusRaw) {
        try {
            Long userId = authUtil.requireUserId();

            List<DispatchBookingSessionEntity> list;
            if (statusRaw == null || statusRaw.isBlank()) {
                list = sessionRepo.listForOwner(userId);
            } else {
                BookingSessionStatus st;
                try {
                    st = BookingSessionStatus.valueOf(statusRaw.trim().toUpperCase());
                } catch (Exception e) {
                    return ServiceResponseDirector.errorBadRequest("Invalid status: " + statusRaw);
                }
                list = sessionRepo.listForOwnerByStatus(userId, st);
            }

            List<BookingSessionResponseDTO> out = new ArrayList<>();
            for (var s : list) {
                BookingSessionResponseDTO dto = mapper.toDto(s);
                dto.setEntries(null); // light list
                out.add(dto);
            }
            return ServiceResponseDirector.successOk(out, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to list sessions: " + e.getMessage());
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
            s.setDocumentDate(req.getDocumentDate() != null ? req.getDocumentDate() : LocalDate.now(ZAGREB));
            s.setStatus(BookingSessionStatus.DRAFT);

            s.persist();

            BookingSessionResponseDTO dto = mapper.toDto(s);
            dto.setEntries(List.of());
            return ServiceResponseDirector.successOk(dto, "Session created.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to create session: " + e.getMessage());
        }
    }

    public ServiceResponseDTO<BookingSessionResponseDTO> getSession(Long sessionId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity s = sessionRepo.findOwned(sessionId, userId);
            if (s == null) return ServiceResponseDirector.errorNotFound("Session not found.");

            List<DispatchBookingSessionEntryEntity> entries = entryRepo.listForSession(sessionId);

            BookingSessionResponseDTO dto = mapper.toDto(s);
            dto.setEntries(entries.stream().map(mapper::toDto).toList());
            return ServiceResponseDirector.successOk(dto, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to fetch session: " + e.getMessage());
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

            // validate template accessible now
            DispatchTemplateEntity t = templateRepo.findFullAccessible(req.getTemplateId(), userId);
            if (t == null) return ServiceResponseDirector.errorBadRequest("Template not accessible.");

            DispatchBookingSessionEntryEntity e = entryRepo.findBySessionAndPartner(sessionId, req.getPartnerId());
            if (e == null) {
                e = new DispatchBookingSessionEntryEntity();
                e.setBookingSession(s);
                e.setPartnerId(req.getPartnerId());
            }

            e.setTemplateId(req.getTemplateId());
            e.setDraftMode(req.getDraftMode());
            e.setDocumentDate(req.getDocumentDate());
            e.setNote(req.getNote());

            e.setDocPatchesJson(mapper.toJson(req.getDocPatches()));
            e.setExtraItemsJson(mapper.toJson(req.getExtraItems()));

            e.persist();

            return ServiceResponseDirector.successOk(mapper.toDto(e), "Entry saved.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to save entry: " + e.getMessage());
        }
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
            return ServiceResponseDirector.errorInternal("Failed to remove entry: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponseDTO<DispatchBulkResponseDTO> finalizeSession(Long sessionId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity s = sessionRepo.findOwned(sessionId, userId);
            if (s == null) return ServiceResponseDirector.errorNotFound("Session not found.");
            if (s.getStatus() != BookingSessionStatus.DRAFT)
                return ServiceResponseDirector.errorBadRequest("Session cannot be finalized.");

            List<DispatchBookingSessionEntryEntity> entries = entryRepo.listForSession(sessionId);
            if (entries.isEmpty()) return ServiceResponseDirector.errorBadRequest("Session has no entries.");

            List<DispatchRequestDTO> allRequests = new ArrayList<>();

            for (DispatchBookingSessionEntryEntity e : entries) {
                DispatchTemplateEntity t = templateRepo.findFullAccessible(e.getTemplateId(), userId);
                if (t == null)
                    return ServiceResponseDirector.errorBadRequest("Template not accessible: " + e.getTemplateId());
                if (t.getDocuments() == null || t.getDocuments().isEmpty()) {
                    return ServiceResponseDirector.errorBadRequest("Template has no documents: " + e.getTemplateId());
                }

                LocalDate docDate = (e.getDocumentDate() != null) ? e.getDocumentDate() : s.getDocumentDate();
                boolean draft = e.getDraftMode().asDraftFlag();

                List<TemplateBookDocPatchDTO> patches = readList(e.getDocPatchesJson(), new com.fasterxml.jackson.core.type.TypeReference<>() {});
                List<TemplateBookItemDTO> extraItems = readList(e.getExtraItemsJson(), new com.fasterxml.jackson.core.type.TypeReference<>() {});

                allRequests.addAll(
                        DispatchTemplateService.buildRequestsForPartner(
                                s.getWarehouseId(),
                                e.getPartnerId(),
                                docDate,
                                draft,
                                patches,
                                extraItems,
                                t
                        )
                );
            }

            ServiceResponseDTO<DispatchBulkResponseDTO> res = oracleBooking.bookBulk(allRequests);

            s.setStatus(BookingSessionStatus.FINALIZED);
            s.setFinalizedAt(OffsetDateTime.now(ZAGREB));
            try { s.setFinalResultJson(om.writeValueAsString(res.getData())); }
            catch (Exception ignore) { s.setFinalResultJson(null); }

            return res;

        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to finalize session: " + e.getMessage());
        }
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
            return ServiceResponseDirector.errorInternal("Failed to cancel session: " + e.getMessage());
        }
    }

    private <T> List<T> readList(String json, TypeReference<List<T>> type) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return om.readValue(json, type);
        } catch (Exception e) {
            return List.of();
        }
    }
}
