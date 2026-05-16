package hr.agape.dispatch.scan.service;

import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.scan.dto.BookingSessionScanEntryUpsertRequestDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanLineCandidateDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanLineDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanLineValidationDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanValidateRequestDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanValidateResponseDTO;
import hr.agape.dispatch.scan.dto.DispatchSlipParsedDTO;
import hr.agape.dispatch.scan.dto.DispatchSlipParsedLineDTO;
import hr.agape.dispatch.scan.util.BookingSessionScanEntryUtil;
import hr.agape.dispatch.scan.util.DispatchSlipImageHeuristicParser;
import hr.agape.dispatch.scan.util.DispatchSlipTextParser;
import hr.agape.dispatch.scan.util.DispatchSlipUploadFileUtil;
import hr.agape.item.dto.ItemDescriptorResponseDTO;
import hr.agape.item.service.ItemDirectoryService;
import hr.agape.item.util.ItemCodeUtil;
import hr.agape.partner.dto.PartnerResponseDTO;
import hr.agape.partner.dto.PartnerSearchFilter;
import hr.agape.partner.service.PartnerService;
import hr.agape.template.domain.DispatchBookingSessionEntity;
import hr.agape.template.domain.DispatchTemplateDocEntity;
import hr.agape.template.domain.DispatchTemplateDocItemEntity;
import hr.agape.template.domain.DispatchTemplateEntity;
import hr.agape.template.dto.BookingSessionEntryResponseDTO;
import hr.agape.template.enumeration.BookingSessionStatus;
import hr.agape.template.repository.DispatchBookingSessionRepository;
import hr.agape.template.repository.DispatchTemplateRepository;
import hr.agape.template.service.DispatchBookingSessionService;
import hr.agape.user.util.AuthUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@ApplicationScoped
public class BookingSessionScanEntryService {

    private final AuthUtil authUtil;
    private final DispatchBookingSessionRepository sessionRepo;
    private final DispatchTemplateRepository templateRepo;
    private final DispatchBookingSessionService sessionService;
    private final ItemDirectoryService itemDirectoryService;
    private final PartnerService partnerService;

    @Inject
    public BookingSessionScanEntryService(
            AuthUtil authUtil,
            DispatchBookingSessionRepository sessionRepo,
            DispatchTemplateRepository templateRepo,
            DispatchBookingSessionService sessionService,
            ItemDirectoryService itemDirectoryService,
            PartnerService partnerService
    ) {
        this.authUtil = authUtil;
        this.sessionRepo = sessionRepo;
        this.templateRepo = templateRepo;
        this.sessionService = sessionService;
        this.itemDirectoryService = itemDirectoryService;
        this.partnerService = partnerService;
    }

    public ServiceResponseDTO<BookingSessionScanValidateResponseDTO> validateScanEntry(
            Long sessionId,
            BookingSessionScanValidateRequestDTO req
    ) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity session = sessionRepo.findOwned(sessionId, userId);
            if (session == null) {
                return ServiceResponseDirector.errorNotFound("Session not found.");
            }

            if (session.getStatus() != BookingSessionStatus.DRAFT) {
                return ServiceResponseDirector.errorBadRequest("Session is not editable.");
            }

            BookingSessionScanValidateResponseDTO dto = buildValidationResponse(session, userId, req);

            return ServiceResponseDirector.successOk(dto, "Scan data validated.");
        } catch (IllegalArgumentException e) {
            return ServiceResponseDirector.errorBadRequest(e.getMessage());
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to validate scan entry.");
        }
    }

    public ServiceResponseDTO<DispatchSlipParsedDTO> parseScanUpload(
            Long sessionId,
            FileUpload file,
            Long partnerId,
            Long templateId,
            String documentDate,
            String note,
            String ocrText
    ) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity session = sessionRepo.findOwned(sessionId, userId);
            if (session == null) {
                return ServiceResponseDirector.errorNotFound("Session not found.");
            }

            if (session.getStatus() != BookingSessionStatus.DRAFT) {
                return ServiceResponseDirector.errorBadRequest("Session is not editable.");
            }

            DispatchSlipUploadFileUtil.validate(file);

            String rawText = DispatchSlipTextParser.normalizeRawText(ocrText);
            DispatchSlipImageHeuristicParser.Analysis imageAnalysis = DispatchSlipImageHeuristicParser.analyze(file);
            PartnerResponseDTO parsedPartner = partnerId == null
                    ? resolvePartner(imageAnalysis.partnerNumber(), rawText, userId)
                    : null;
            Long effectivePartnerId = partnerId != null
                    ? partnerId
                    : parsedPartner == null ? null : parsedPartner.getId();

            BookingSessionScanValidateRequestDTO req = new BookingSessionScanValidateRequestDTO();
            req.setPartnerId(effectivePartnerId);
            req.setTemplateId(templateId);
            req.setDocumentDate(resolveDocumentDate(imageAnalysis.documentDate(), documentDate));
            req.setNote(note);
            req.setLines(applyImageQuantities(DispatchSlipTextParser.buildCandidates(rawText), imageAnalysis.quantities()));

            BookingSessionScanValidateResponseDTO validation = buildValidationResponse(session, userId, req);
            DispatchSlipParsedDTO parsed = toParsedDto(session, validation, note, rawText);
            parsed.setDetectedPartnerText(resolveDetectedPartnerText(imageAnalysis.partnerNumber(), rawText));
            parsed.setPartnerResolved(effectivePartnerId != null);
            parsed.setRequiresManualPartner(effectivePartnerId == null);

            return ServiceResponseDirector.successOk(parsed, "Scan parsed.");
        } catch (IllegalArgumentException e) {
            return ServiceResponseDirector.errorBadRequest(e.getMessage());
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to parse scan.");
        }
    }

    public ServiceResponseDTO<BookingSessionEntryResponseDTO> upsertScanEntry(
            Long sessionId,
            BookingSessionScanEntryUpsertRequestDTO req
    ) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity session = sessionRepo.findOwned(sessionId, userId);
            if (session == null) {
                return ServiceResponseDirector.errorNotFound("Session not found.");
            }

            if (session.getStatus() != BookingSessionStatus.DRAFT) {
                return ServiceResponseDirector.errorBadRequest("Session is not editable.");
            }

            BookingSessionScanValidateRequestDTO validateReq = toValidateRequest(req);
            BookingSessionScanValidateResponseDTO validation = buildValidationResponse(session, userId, validateReq);

            if (!Boolean.TRUE.equals(validation.getAllValid())) {
                return ServiceResponseDirector.errorBadRequest("Scan lines are not fully validated.");
            }

            return sessionService.upsertEntry(
                    sessionId,
                    BookingSessionScanEntryUtil.toEntryRequest(req, resolveScanNote(req.getNote()))
            );
        } catch (IllegalArgumentException e) {
            return ServiceResponseDirector.errorBadRequest(e.getMessage());
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to save scan entry.");
        }
    }

    private BookingSessionScanValidateResponseDTO buildValidationResponse(
            DispatchBookingSessionEntity session,
            Long userId,
            BookingSessionScanValidateRequestDTO req
    ) {
        DispatchTemplateEntity template = resolveTemplate(req.getTemplateId(), userId);

        List<BookingSessionScanLineValidationDTO> lines = req.getLines().stream()
                .filter(Objects::nonNull)
                .map(this::toValidationLine)
                .toList();

        enrichFromItemIds(lines);
        enrichFromItemCodes(lines, session.getWarehouseId());
        enrichFromNumericSlipItemIds(lines);
        enrichDocumentIdsFromTemplate(lines, template);
        applyValidationFlags(lines, req.getTemplateId());

        boolean hasPositiveLine = lines.stream().anyMatch(this::hasPositiveQuantity);

        BookingSessionScanValidateResponseDTO dto = new BookingSessionScanValidateResponseDTO();
        dto.setSessionId(session.getId());
        dto.setPartnerId(req.getPartnerId());
        dto.setPartnerName(resolvePartnerName(req.getPartnerId()));
        dto.setTemplateId(req.getTemplateId());
        dto.setDocumentDate(req.getDocumentDate());
        dto.setPartnerResolved(req.getPartnerId() != null);
        dto.setRequiresManualPartner(req.getPartnerId() == null);
        dto.setLines(lines);
        dto.setAllValid(hasPositiveLine && lines.stream().allMatch(line -> Boolean.TRUE.equals(line.getValid())));

        return dto;
    }

    private DispatchTemplateEntity resolveTemplate(Long templateId, Long userId) {
        if (templateId == null) {
            return null;
        }

        DispatchTemplateEntity template = templateRepo.findFullAccessible(templateId, userId);

        if (template == null) {
            throw new IllegalArgumentException("Template not accessible.");
        }

        return template;
    }

    private BookingSessionScanLineValidationDTO toValidationLine(BookingSessionScanLineCandidateDTO source) {
        BookingSessionScanLineValidationDTO line = new BookingSessionScanLineValidationDTO();
        line.setDocumentId(source.getDocumentId());
        line.setSlipItemCode(source.getSlipItemCode());
        line.setSource(source.getSource());
        line.setItemId(source.getItemId());
        line.setItemCode(source.getItemCode());
        line.setItemName(source.getItemName());
        line.setUnit(source.getUnit());
        line.setQuantity(source.getQuantity());
        return line;
    }

    private List<BookingSessionScanLineCandidateDTO> applyImageQuantities(
            List<BookingSessionScanLineCandidateDTO> lines,
            Map<String, BigDecimal> imageQuantities
    ) {
        if (imageQuantities == null || imageQuantities.isEmpty()) {
            return lines;
        }

        for (BookingSessionScanLineCandidateDTO line : lines) {
            if (line == null || line.getQuantity() != null) {
                continue;
            }

            String code = ItemCodeUtil.firstNonBlank(line.getSlipItemCode(), line.getItemCode());
            if (code == null) {
                continue;
            }

            BigDecimal quantity = imageQuantities.get(ItemCodeUtil.normalize(code));
            if (quantity != null) {
                line.setQuantity(quantity);
            }
        }

        return lines;
    }

    private void enrichFromItemIds(List<BookingSessionScanLineValidationDTO> lines) {
        List<Long> itemIds = lines.stream()
                .map(BookingSessionScanLineValidationDTO::getItemId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (itemIds.isEmpty()) {
            return;
        }

        Map<Long, ItemDescriptorResponseDTO> itemById = itemDirectoryService.findItemsByIds(itemIds);

        for (BookingSessionScanLineValidationDTO line : lines) {
            if (line.getItemId() == null) {
                continue;
            }

            ItemDescriptorResponseDTO item = itemById.get(line.getItemId());
            if (item == null) {
                continue;
            }

            applyItem(line, item);
        }
    }

    private void enrichFromItemCodes(List<BookingSessionScanLineValidationDTO> lines, Long warehouseId) {
        if (warehouseId == null) {
            return;
        }

        List<String> codes = lines.stream()
                .filter(line -> line.getItemId() == null)
                .map(line -> ItemCodeUtil.firstNonBlank(line.getSlipItemCode(), line.getItemCode()))
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (codes.isEmpty()) {
            return;
        }

        Map<String, ItemDescriptorResponseDTO> itemByCode = itemDirectoryService.findItemsByCodes(warehouseId, codes);

        for (BookingSessionScanLineValidationDTO line : lines) {
            if (line.getItemId() != null) {
                continue;
            }

            String rawCode = ItemCodeUtil.firstNonBlank(line.getSlipItemCode(), line.getItemCode());
            if (rawCode == null) {
                continue;
            }

            ItemDescriptorResponseDTO item = itemByCode.get(ItemCodeUtil.normalize(rawCode));
            if (item == null) {
                continue;
            }

            applyItem(line, item);
        }
    }

    private void enrichFromNumericSlipItemIds(List<BookingSessionScanLineValidationDTO> lines) {
        List<Long> itemIds = lines.stream()
                .filter(line -> line.getItemId() == null)
                .map(line -> ItemCodeUtil.firstNonBlank(line.getSlipItemCode(), line.getItemCode()))
                .map(this::parsePositiveLong)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (itemIds.isEmpty()) {
            return;
        }

        Map<Long, ItemDescriptorResponseDTO> itemById = itemDirectoryService.findItemsByIds(itemIds);

        for (BookingSessionScanLineValidationDTO line : lines) {
            if (line.getItemId() != null) {
                continue;
            }

            Long itemId = parsePositiveLong(ItemCodeUtil.firstNonBlank(line.getSlipItemCode(), line.getItemCode()));
            if (itemId == null) {
                continue;
            }

            ItemDescriptorResponseDTO item = itemById.get(itemId);
            if (item == null) {
                continue;
            }

            applyItem(line, item);
        }
    }

    private void enrichDocumentIdsFromTemplate(
            List<BookingSessionScanLineValidationDTO> lines,
            DispatchTemplateEntity template
    ) {
        if (template == null || template.getDocuments() == null || template.getDocuments().isEmpty()) {
            return;
        }

        Map<Long, Long> documentIdByItemId = buildDocumentIdByItemId(template);

        for (BookingSessionScanLineValidationDTO line : lines) {
            if (line.getDocumentId() != null || line.getItemId() == null) {
                continue;
            }

            line.setDocumentId(documentIdByItemId.get(line.getItemId()));
        }
    }

    private Map<Long, Long> buildDocumentIdByItemId(DispatchTemplateEntity template) {
        Map<Long, Long> documentIdByItemId = new LinkedHashMap<>();

        var docs = template.getDocuments().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingInt((DispatchTemplateDocEntity doc) ->
                                doc.getSortOrder() == null ? Integer.MAX_VALUE : doc.getSortOrder())
                        .thenComparingLong(doc -> doc.getId() == null ? Long.MAX_VALUE : doc.getId()))
                .toList();

        for (DispatchTemplateDocEntity doc : docs) {
            if (doc.getItems() == null || doc.getItems().isEmpty()) {
                continue;
            }

            List<DispatchTemplateDocItemEntity> items = doc.getItems().stream()
                    .filter(Objects::nonNull)
                    .sorted(Comparator.comparingInt((DispatchTemplateDocItemEntity item) ->
                                    item.getSortOrder() == null ? Integer.MAX_VALUE : item.getSortOrder())
                            .thenComparingLong(item -> item.getId() == null ? Long.MAX_VALUE : item.getId()))
                    .toList();

            for (DispatchTemplateDocItemEntity item : items) {
                if (item.getItemId() != null) {
                    documentIdByItemId.putIfAbsent(item.getItemId(), doc.getDocumentId());
                }
            }
        }

        return documentIdByItemId;
    }

    private void applyValidationFlags(List<BookingSessionScanLineValidationDTO> lines, Long templateId) {
        for (BookingSessionScanLineValidationDTO line : lines) {
            boolean hasPositiveQuantity = hasPositiveQuantity(line);
            boolean itemResolved = line.getItemId() != null;

            line.setItemResolved(itemResolved);
            line.setQuantityValid(hasPositiveQuantity);
            line.setMappedToTemplateDocument(templateId != null && line.getDocumentId() != null);
            line.setRequiresManualItem(hasPositiveQuantity && !itemResolved);
            line.setRequiresManualQuantity(false);
            line.setValid(!hasPositiveQuantity || itemResolved);
            line.setWarning(resolveLineWarning(line, hasPositiveQuantity, itemResolved));
        }
    }

    private void applyItem(BookingSessionScanLineValidationDTO line, ItemDescriptorResponseDTO item) {
        line.setItemId(item.getItemId());
        line.setItemCode(item.getCode());
        line.setItemName(item.getName());
        line.setUnit(item.getUnit());
    }

    private BookingSessionScanValidateRequestDTO toValidateRequest(BookingSessionScanEntryUpsertRequestDTO req) {
        BookingSessionScanValidateRequestDTO validateReq = new BookingSessionScanValidateRequestDTO();
        validateReq.setPartnerId(req.getPartnerId());
        validateReq.setTemplateId(req.getTemplateId());
        validateReq.setDocumentDate(req.getDocumentDate());
        validateReq.setNote(req.getNote());
        validateReq.setLines(req.getLines().stream().map(this::toCandidateLine).toList());
        return validateReq;
    }

    private BookingSessionScanLineCandidateDTO toCandidateLine(BookingSessionScanLineDTO source) {
        BookingSessionScanLineCandidateDTO line = new BookingSessionScanLineCandidateDTO();
        line.setDocumentId(source.getDocumentId());
        line.setSlipItemCode(source.getSlipItemCode());
        line.setSource(source.getSource());
        line.setItemId(source.getItemId());
        line.setItemCode(source.getItemCode());
        line.setItemName(source.getItemName());
        line.setUnit(source.getUnit());
        line.setQuantity(source.getQuantity());
        return line;
    }

    private String resolvePartnerName(Long partnerId) {
        if (partnerId == null) {
            return null;
        }

        PartnerResponseDTO partner = partnerService.findPartnersByIds(List.of(partnerId)).get(partnerId);
        return partner == null ? null : partner.getName();
    }

    private PartnerResponseDTO resolvePartnerFromText(String rawText, Long userId) {
        for (String term : DispatchSlipTextParser.partnerSearchTerms(rawText)) {
            try {
                PartnerSearchFilter filter = new PartnerSearchFilter();
                filter.setTenantId(userId);
                filter.setActiveOnly(Boolean.TRUE);
                filter.setNameContains(term);
                filter.setPage(0);
                filter.setSize(1);

                ServiceResponseDTO<PagedResultDTO<PartnerResponseDTO>> response = partnerService.search(filter);
                if (!response.isSuccess() || response.getData() == null || response.getData().getItems() == null) {
                    continue;
                }

                if (response.getData().getItems().size() == 1) {
                    return response.getData().getItems().getFirst();
                }
            } catch (Exception ignored) {
            }
        }

        return null;
    }

    private PartnerResponseDTO resolvePartner(Integer partnerNumber, String rawText, Long userId) {
        if (partnerNumber != null) {
            PartnerResponseDTO byNumber = partnerService.findByPartnerNumber(userId, partnerNumber);
            if (byNumber != null) {
                return byNumber;
            }
        }

        return resolvePartnerFromText(rawText, userId);
    }

    private String firstPartnerSearchTerm(String rawText) {
        List<String> terms = DispatchSlipTextParser.partnerSearchTerms(rawText);
        return terms.isEmpty() ? null : terms.getFirst();
    }

    private String resolveDetectedPartnerText(Integer partnerNumber, String rawText) {
        if (partnerNumber != null) {
            return "#" + partnerNumber;
        }

        return firstPartnerSearchTerm(rawText);
    }

    private String resolveScanNote(String note) {
        if (note != null && !note.isBlank()) {
            return note.trim();
        }

        return "Skenirano sa papira";
    }

    private LocalDate resolveDocumentDate(LocalDate imageDate, String value) {
        if (imageDate != null) {
            return imageDate;
        }

        if (value == null || value.isBlank()) {
            return null;
        }

        return LocalDate.parse(value.trim());
    }

    private boolean hasPositiveQuantity(BookingSessionScanLineValidationDTO line) {
        return line != null
                && line.getQuantity() != null
                && line.getQuantity().signum() > 0;
    }

    private Long parsePositiveLong(String value) {
        if (value == null) {
            return null;
        }

        String digits = value.trim();
        if (!digits.matches("\\d{1,18}")) {
            return null;
        }

        try {
            long parsed = Long.parseLong(digits);
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String resolveLineWarning(
            BookingSessionScanLineValidationDTO line,
            boolean hasPositiveQuantity,
            boolean itemResolved
    ) {
        if (!hasPositiveQuantity) {
            return null;
        }

        if (!itemResolved) {
            String code = ItemCodeUtil.firstNonBlank(line.getSlipItemCode(), line.getItemCode());
            return code == null
                    ? "Artikl nije prepoznat. Odaberi artikl prije spremanja."
                    : "Artikl za šifru " + code + " nije pronađen. Odaberi artikl prije spremanja.";
        }

        return null;
    }

    private DispatchSlipParsedDTO toParsedDto(
            DispatchBookingSessionEntity session,
            BookingSessionScanValidateResponseDTO validation,
            String note,
            String rawText
    ) {
        DispatchSlipParsedDTO dto = new DispatchSlipParsedDTO();
        dto.setBookingSessionId(session.getId());
        dto.setPartnerId(validation.getPartnerId());
        dto.setPartnerName(validation.getPartnerName());
        dto.setTemplateId(validation.getTemplateId());
        dto.setWarehouseId(session.getWarehouseId());
        dto.setDocumentDate(validation.getDocumentDate());
        dto.setRawText(rawText);
        dto.setPartnerResolved(validation.getPartnerResolved());
        dto.setRequiresManualPartner(validation.getRequiresManualPartner());
        dto.setAllValid(validation.getAllValid());
        dto.setNote(resolveScanNote(note));
        dto.setLines(validation.getLines().stream().map(this::toParsedLine).toList());
        dto.setWarnings(validation.getLines().stream()
                .map(BookingSessionScanLineValidationDTO::getWarning)
                .filter(Objects::nonNull)
                .distinct()
                .toList());
        return dto;
    }

    private DispatchSlipParsedLineDTO toParsedLine(BookingSessionScanLineValidationDTO validationLine) {
        DispatchSlipParsedLineDTO line = new DispatchSlipParsedLineDTO();
        line.setDocumentId(validationLine.getDocumentId());
        line.setSlipItemCode(validationLine.getSlipItemCode());
        line.setSource(validationLine.getSource());
        line.setItemId(validationLine.getItemId());
        line.setItemCode(validationLine.getItemCode());
        line.setItemName(validationLine.getItemName());
        line.setUnit(validationLine.getUnit());
        line.setQuantity(validationLine.getQuantity());
        line.setItemResolved(validationLine.getItemResolved());
        line.setQuantityValid(validationLine.getQuantityValid());
        line.setRequiresManualItem(validationLine.getRequiresManualItem());
        line.setRequiresManualQuantity(validationLine.getRequiresManualQuantity());
        line.setValid(validationLine.getValid());
        line.setWarning(validationLine.getWarning());
        return line;
    }
}
