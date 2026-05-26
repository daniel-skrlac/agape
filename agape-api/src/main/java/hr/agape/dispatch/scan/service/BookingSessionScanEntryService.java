package hr.agape.dispatch.scan.service;

import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.scan.client.DispatchSlipAnalyzerClient;
import hr.agape.dispatch.scan.dto.BookingSessionScanEntryUpsertRequestDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanLineCandidateDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanLineValidationDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanValidateRequestDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanValidateResponseDTO;
import hr.agape.dispatch.scan.dto.DispatchSlipAnalyzerQuantityDTO;
import hr.agape.dispatch.scan.dto.DispatchSlipAnalyzerResponseDTO;
import hr.agape.dispatch.scan.dto.DispatchSlipParsedDTO;
import hr.agape.dispatch.scan.mapper.BookingSessionScanEntryMapper;
import hr.agape.dispatch.scan.util.BookingSessionScanEntryUtil;
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
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@ApplicationScoped
public class BookingSessionScanEntryService {

    private static final BigDecimal CONFIDENCE_HIGH = new BigDecimal("0.80");
    private static final BigDecimal CONFIDENCE_MEDIUM = new BigDecimal("0.60");
    private static final BigDecimal DOCUMENT_DATE_AUTO_ACCEPT_CONFIDENCE = new BigDecimal("0.75");

    private static final Pattern LEADING_PARTNER_NUMBER_PATTERN = Pattern.compile(
            "^\\s*(\\d{3,4})\\s+[\\p{L}].*",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    private static final Pattern CROATIAN_DATE_PATTERN = Pattern.compile(
            "\\b(\\d{1,2})\\s*[./-]\\s*(\\d{1,2})\\s*[./-]\\s*(\\d{4})\\b"
    );

    private final AuthUtil authUtil;
    private final DispatchBookingSessionRepository sessionRepo;
    private final DispatchTemplateRepository templateRepo;
    private final DispatchBookingSessionService sessionService;
    private final ItemDirectoryService itemDirectoryService;
    private final PartnerService partnerService;
    private final BookingSessionScanEntryMapper mapper;
    private final DispatchSlipAnalyzerClient analyzerClient;

    @Inject
    public BookingSessionScanEntryService(
            AuthUtil authUtil,
            DispatchBookingSessionRepository sessionRepo,
            DispatchTemplateRepository templateRepo,
            DispatchBookingSessionService sessionService,
            ItemDirectoryService itemDirectoryService,
            PartnerService partnerService,
            BookingSessionScanEntryMapper mapper,
            DispatchSlipAnalyzerClient analyzerClient
    ) {
        this.authUtil = authUtil;
        this.sessionRepo = sessionRepo;
        this.templateRepo = templateRepo;
        this.sessionService = sessionService;
        this.itemDirectoryService = itemDirectoryService;
        this.partnerService = partnerService;
        this.mapper = mapper;
        this.analyzerClient = analyzerClient;
    }

    public ServiceResponseDTO<BookingSessionScanValidateResponseDTO> validateScanEntry(
            Long sessionId,
            BookingSessionScanValidateRequestDTO req
    ) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity session = findEditableSession(sessionId, userId);
            if (session == null) {
                return ServiceResponseDirector.errorNotFound("Session not found.");
            }

            return ServiceResponseDirector.successOk(
                    buildValidationResponse(session, userId, req),
                    "Scan data validated."
            );
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
            String note
    ) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchBookingSessionEntity session = findEditableSession(sessionId, userId);
            if (session == null) {
                return ServiceResponseDirector.errorNotFound("Session not found.");
            }

            DispatchSlipUploadFileUtil.validate(file);

            DispatchSlipAnalyzerResponseDTO analysis = analyzerClient.analyze(file);
            String rawText = DispatchSlipTextParser.normalizeRawText(analysis.getRawText());

            Integer detectedPartnerNumber = resolvePartnerNumber(rawText, analysis.getPartnerNumber());
            boolean allowPartnerTextFallback = !hasSuspiciousInvalidAnalyzerPartnerNumber(analysis.getPartnerNumber());

            PartnerResponseDTO parsedPartner = partnerId == null
                    ? resolvePartner(detectedPartnerNumber, analysis.getPartnerText(), rawText, userId, allowPartnerTextFallback)
                    : null;

            Long effectivePartnerId = partnerId != null
                    ? partnerId
                    : parsedPartner == null ? null : parsedPartner.getId();

            List<BookingSessionScanLineCandidateDTO> candidates = mergeQuantitiesWithCandidates(
                    DispatchSlipTextParser.buildCandidates(rawText),
                    analysis.getQuantities(),
                    analysis.getQuantityConfidences(),
                    analysis.getQuantityResults()
            );

            LocalDate resolvedDocumentDate = resolveDocumentDate(
                    rawText,
                    analysis.getDocumentDate(),
                    analysis.getDocumentDateConfidence(),
                    documentDate
            );

            BookingSessionScanValidateRequestDTO validateReq = new BookingSessionScanValidateRequestDTO();
            validateReq.setPartnerId(effectivePartnerId);
            validateReq.setTemplateId(templateId);
            validateReq.setDocumentDate(resolvedDocumentDate);
            validateReq.setNote(note);
            validateReq.setLines(candidates);

            BookingSessionScanValidateResponseDTO validation =
                    buildValidationResponse(session, userId, validateReq);

            DispatchSlipParsedDTO parsed = mapper.toParsedDto(session, validation, note, rawText);
            parsed.setDetectedPartnerText(resolveDetectedPartnerText(
                    detectedPartnerNumber,
                    analysis.getPartnerText(),
                    rawText,
                    allowPartnerTextFallback
            ));
            parsed.setPartnerConfidence(resolvePartnerConfidence(analysis, detectedPartnerNumber, allowPartnerTextFallback));
            parsed.setDocumentDateConfidence(analysis.getDocumentDateConfidence());
            parsed.setProcessingMs(analysis.getProcessingMs());
            parsed.setImageQuality(analysis.getImageQuality());
            parsed.setPartnerResolved(effectivePartnerId != null);
            parsed.setRequiresManualPartner(effectivePartnerId == null);

            parsed.setWarnings(mergeWarnings(parsed.getWarnings(), analysis, resolvedDocumentDate, documentDate));

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

            DispatchBookingSessionEntity session = findEditableSession(sessionId, userId);
            if (session == null) {
                return ServiceResponseDirector.errorNotFound("Session not found.");
            }

            BookingSessionScanValidateResponseDTO validation = buildValidationResponse(
                    session,
                    userId,
                    mapper.toValidateRequest(req)
            );

            if (!Boolean.TRUE.equals(validation.getAllValid())) {
                return ServiceResponseDirector.errorBadRequest("Scan lines are not fully validated.");
            }

            return sessionService.upsertEntry(
                    sessionId,
                    BookingSessionScanEntryUtil.toEntryRequest(req, mapper.resolveScanNote(req.getNote()))
            );
        } catch (IllegalArgumentException e) {
            return ServiceResponseDirector.errorBadRequest(e.getMessage());
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to save scan entry.");
        }
    }

    private DispatchBookingSessionEntity findEditableSession(Long sessionId, Long userId) {
        DispatchBookingSessionEntity session = sessionRepo.findOwned(sessionId, userId);

        if (session == null) {
            return null;
        }

        if (session.getStatus() != BookingSessionStatus.DRAFT) {
            throw new IllegalArgumentException("Session is not editable.");
        }

        return session;
    }

    private BookingSessionScanValidateResponseDTO buildValidationResponse(
            DispatchBookingSessionEntity session,
            Long userId,
            BookingSessionScanValidateRequestDTO req
    ) {
        DispatchTemplateEntity template = resolveTemplate(req.getTemplateId(), userId);

        List<BookingSessionScanLineValidationDTO> lines = mapper.toValidationLines(
                req.getLines() == null ? List.of() : req.getLines()
        );

        enrichFromItemIds(lines);
        enrichFromItemCodes(lines, session.getWarehouseId());
        enrichDocumentIdsFromTemplate(lines, template);
        applyValidationFlags(lines, req.getTemplateId());

        boolean hasPositiveLine = lines.stream()
                .anyMatch(line -> line.getQuantity() != null && line.getQuantity().signum() > 0);
        boolean allLinesValid = lines.stream()
                .allMatch(line -> Boolean.TRUE.equals(line.getValid()));
        boolean partnerResolved = req.getPartnerId() != null;

        return mapper.toValidationResponse(
                session,
                req,
                resolvePartnerName(req.getPartnerId()),
                lines,
                partnerResolved,
                partnerResolved && hasPositiveLine && allLinesValid
        );
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
            if (item != null) {
                mapper.applyItem(item, line);
            }
        }
    }

    private void enrichFromItemCodes(List<BookingSessionScanLineValidationDTO> lines, Long warehouseId) {
        if (warehouseId == null) {
            return;
        }

        List<String> codes = lines.stream()
                .filter(line -> line.getItemId() == null)
                .map(line -> ItemCodeUtil.firstNonBlank(line.getSlipItemCode(), line.getItemCode()))
                .map(this::normalizeSlipCode)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (codes.isEmpty()) {
            return;
        }

        Map<String, ItemDescriptorResponseDTO> itemByCode =
                itemDirectoryService.findItemsByCodes(warehouseId, codes);

        for (BookingSessionScanLineValidationDTO line : lines) {
            if (line.getItemId() != null) {
                continue;
            }

            String code = normalizeSlipCode(ItemCodeUtil.firstNonBlank(
                    line.getSlipItemCode(),
                    line.getItemCode()
            ));

            if (code == null) {
                continue;
            }

            ItemDescriptorResponseDTO item = itemByCode.get(code);
            if (item == null) {
                item = itemByCode.get(ItemCodeUtil.normalize(code));
            }

            if (item != null) {
                mapper.applyItem(item, line);
            }
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
            if (line.getDocumentId() == null && line.getItemId() != null) {
                line.setDocumentId(documentIdByItemId.get(line.getItemId()));
            }
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
            boolean hasPositiveQuantity = line.getQuantity() != null && line.getQuantity().signum() > 0;
            boolean itemResolved = line.getItemId() != null;
            boolean mappedToTemplateDocument = templateId != null && line.getDocumentId() != null;

            line.setItemResolved(itemResolved);
            line.setQuantityValid(hasPositiveQuantity);
            line.setMappedToTemplateDocument(mappedToTemplateDocument);
            line.setRequiresManualItem(hasPositiveQuantity && !itemResolved);
            line.setRequiresManualQuantity(false);

            if (line.getConfidenceLevel() == null) {
                line.setConfidenceLevel(resolveConfidenceLevel(line.getConfidence()));
            }

            line.setValid(!hasPositiveQuantity || itemResolved);
            line.setWarning(resolveLineWarning(line, hasPositiveQuantity, itemResolved));
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

        if ("LOW".equals(line.getConfidenceLevel())) {
            return "Niska sigurnost prepoznavanja količine. Provjeri količinu prije spremanja.";
        }

        if ("MEDIUM".equals(line.getConfidenceLevel())) {
            return "Provjeri prepoznatu količinu.";
        }

        return null;
    }

    private List<BookingSessionScanLineCandidateDTO> mergeQuantitiesWithCandidates(
            List<BookingSessionScanLineCandidateDTO> textCandidates,
            Map<String, BigDecimal> quantities,
            Map<String, BigDecimal> quantityConfidences,
            List<DispatchSlipAnalyzerQuantityDTO> quantityResults
    ) {
        List<BookingSessionScanLineCandidateDTO> out = new ArrayList<>();
        Map<String, BookingSessionScanLineCandidateDTO> bySlipCode = new LinkedHashMap<>();

        if (textCandidates != null) {
            for (BookingSessionScanLineCandidateDTO candidate : textCandidates) {
                if (candidate == null) {
                    continue;
                }

                String code = normalizeSlipCode(ItemCodeUtil.firstNonBlank(
                        candidate.getSlipItemCode(),
                        candidate.getItemCode()
                ));

                if (code != null) {
                    bySlipCode.putIfAbsent(code, candidate);
                }

                out.add(candidate);
            }
        }

        if (quantityResults != null && !quantityResults.isEmpty()) {
            for (DispatchSlipAnalyzerQuantityDTO result : quantityResults) {
                if (result == null) {
                    continue;
                }

                String code = normalizeSlipCode(result.getSlipItemCode());
                BigDecimal quantity = result.getQuantity();

                if (code == null || quantity == null || quantity.signum() <= 0) {
                    continue;
                }

                BookingSessionScanLineCandidateDTO line = bySlipCode.get(code);
                if (line == null) {
                    line = new BookingSessionScanLineCandidateDTO();
                    out.add(line);
                    bySlipCode.put(code, line);
                }

                BigDecimal confidence = result.getConfidence();

                line.setSlipItemCode(code);
                line.setItemCode(code);
                line.setQuantity(quantity);
                line.setConfidence(confidence);
                line.setConfidenceLevel(resolveConfidenceLevel(confidence));
                line.setSource(DispatchSlipTextParser.SOURCE_FIXED_LAYOUT);
            }
        } else if (quantities != null) {
            for (Map.Entry<String, BigDecimal> entry : quantities.entrySet()) {
                String code = normalizeSlipCode(entry.getKey());
                BigDecimal quantity = entry.getValue();

                if (code == null || quantity == null || quantity.signum() <= 0) {
                    continue;
                }

                BookingSessionScanLineCandidateDTO line = bySlipCode.get(code);
                if (line == null) {
                    line = new BookingSessionScanLineCandidateDTO();
                    out.add(line);
                    bySlipCode.put(code, line);
                }

                BigDecimal confidence = resolveConfidence(code, quantityConfidences);

                line.setSlipItemCode(code);
                line.setItemCode(code);
                line.setQuantity(quantity);
                line.setConfidence(confidence);
                line.setConfidenceLevel(resolveConfidenceLevel(confidence));
                line.setSource(DispatchSlipTextParser.SOURCE_FIXED_LAYOUT);
            }
        }

        return out.stream()
                .filter(line -> line != null
                        && ((line.getQuantity() != null && line.getQuantity().signum() > 0)
                        || line.getItemId() != null
                        || notBlank(line.getSlipItemCode())
                        || notBlank(line.getItemCode())))
                .toList();
    }

    private BigDecimal resolveConfidence(String code, Map<String, BigDecimal> confidences) {
        if (code == null || confidences == null || confidences.isEmpty()) {
            return null;
        }

        BigDecimal confidence = confidences.get(code);
        if (confidence != null) {
            return confidence;
        }

        return confidences.get(ItemCodeUtil.normalize(code));
    }

    private String resolveConfidenceLevel(BigDecimal confidence) {
        if (confidence == null) {
            return "UNKNOWN";
        }

        if (confidence.compareTo(CONFIDENCE_HIGH) >= 0) {
            return "HIGH";
        }

        if (confidence.compareTo(CONFIDENCE_MEDIUM) >= 0) {
            return "MEDIUM";
        }

        return "LOW";
    }

    private BigDecimal resolvePartnerConfidence(
            DispatchSlipAnalyzerResponseDTO analysis,
            Integer detectedPartnerNumber,
            boolean allowPartnerTextFallback
    ) {
        if (analysis == null) {
            return null;
        }

        if (detectedPartnerNumber != null
                && analysis.getPartnerNumber() != null
                && analysis.getPartnerNumber().equals(detectedPartnerNumber)) {
            return analysis.getPartnerNumberConfidence();
        }

        if (allowPartnerTextFallback) {
            return analysis.getPartnerTextConfidence();
        }

        return null;
    }

    private PartnerResponseDTO resolvePartner(
            Integer partnerNumber,
            String partnerText,
            String rawText,
            Long userId,
            boolean allowTextFallback
    ) {
        Set<Integer> numberCandidates = new LinkedHashSet<>();

        addPartnerNumber(numberCandidates, partnerNumber);
        addPartnerNumber(numberCandidates, parsePartnerNumberFromText(rawText));

        for (Integer candidate : numberCandidates) {
            PartnerResponseDTO byNumber = partnerService.findByPartnerNumber(userId, candidate);
            if (byNumber != null) {
                return byNumber;
            }
        }

        // If analyzer/read text gave a number but it was not found, do not guess by random OCR name.
        if (!numberCandidates.isEmpty() || !allowTextFallback) {
            return null;
        }

        List<String> textCandidates = new ArrayList<>();

        if (partnerText != null && !partnerText.isBlank()) {
            textCandidates.add(partnerText.trim());
        }

        textCandidates.addAll(DispatchSlipTextParser.partnerSearchTerms(rawText));

        for (String term : textCandidates) {
            PartnerResponseDTO partner = findSinglePartnerByName(term, userId);
            if (partner != null) {
                return partner;
            }
        }

        return null;
    }

    private void addPartnerNumber(Set<Integer> out, Integer number) {
        if (number == null || number < 100 || number > 9999) {
            return;
        }

        out.add(number);

        if (number < 1000) {
            out.add(number + 1000);
        }

        if (number >= 1000 && number % 10 == 0) {
            int withoutTrailingZero = number / 10;
            if (withoutTrailingZero >= 100) {
                out.add(withoutTrailingZero);

                if (withoutTrailingZero < 1000) {
                    out.add(withoutTrailingZero + 1000);
                }
            }
        }
    }

    private PartnerResponseDTO findSinglePartnerByName(String term, Long userId) {
        if (term == null || term.isBlank()) {
            return null;
        }

        try {
            PartnerSearchFilter filter = new PartnerSearchFilter();
            filter.setTenantId(userId);
            filter.setActiveOnly(Boolean.TRUE);
            filter.setNameContains(term.trim());
            filter.setPage(0);
            filter.setSize(2);

            ServiceResponseDTO<PagedResultDTO<PartnerResponseDTO>> response = partnerService.search(filter);

            if (!response.isSuccess()
                    || response.getData() == null
                    || response.getData().getItems() == null
                    || response.getData().getItems().size() != 1) {
                return null;
            }

            return response.getData().getItems().get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private String resolveDetectedPartnerText(
            Integer partnerNumber,
            String partnerText,
            String rawText,
            boolean allowTextFallback
    ) {
        if (partnerNumber != null) {
            return "#" + partnerNumber;
        }

        if (allowTextFallback && partnerText != null && !partnerText.isBlank()) {
            return partnerText.trim();
        }

        if (!allowTextFallback) {
            return null;
        }

        List<String> terms = DispatchSlipTextParser.partnerSearchTerms(rawText);
        return terms.isEmpty() ? null : terms.get(0);
    }

    private String resolvePartnerName(Long partnerId) {
        if (partnerId == null) {
            return null;
        }

        PartnerResponseDTO partner = partnerService.findPartnersByIds(List.of(partnerId)).get(partnerId);
        return partner == null ? null : partner.getName();
    }

    private Integer resolvePartnerNumber(String rawText, Integer analyzerPartnerNumber) {
        if (analyzerPartnerNumber != null && analyzerPartnerNumber >= 100 && analyzerPartnerNumber <= 9999) {
            return analyzerPartnerNumber;
        }

        Integer fromText = parsePartnerNumberFromText(rawText);
        if (fromText != null && fromText >= 100 && fromText <= 9999) {
            return fromText;
        }

        return null;
    }

    private boolean hasSuspiciousInvalidAnalyzerPartnerNumber(Integer number) {
        return number != null && (number < 100 || number > 9999);
    }

    private Integer parsePartnerNumberFromText(String rawText) {
        if (rawText == null || rawText.isBlank()) {
            return null;
        }

        int inspectedLines = 0;
        for (String rawLine : rawText.split("\\R+")) {
            if (inspectedLines++ >= 8) {
                break;
            }

            String line = rawLine == null ? "" : rawLine.trim();
            if (looksLikeScannerChrome(line) || looksLikeItemLine(line)) {
                continue;
            }

            Matcher leadingMatcher = LEADING_PARTNER_NUMBER_PATTERN.matcher(line);
            if (!leadingMatcher.matches()) {
                continue;
            }

            Integer number = parsePositiveInt(leadingMatcher.group(1));
            if (number != null && number >= 100 && number <= 9999) {
                return number;
            }
        }

        return null;
    }

    private boolean looksLikeScannerChrome(String line) {
        if (line == null) {
            return false;
        }

        String lower = line.toLowerCase();
        return lower.contains("camscanner")
                || lower.contains("add pages")
                || lower.contains("enhance")
                || lower.contains("grayscale");
    }

    private boolean looksLikeItemLine(String line) {
        if (line == null) {
            return false;
        }

        String normalized = line.trim().toLowerCase();
        return normalized.matches("^0{0,3}[1-9]\\b.*")
                || normalized.matches("^00[1-3][0-9]\\b.*")
                || normalized.contains("brašno")
                || normalized.contains("brasno")
                || normalized.contains("šećer")
                || normalized.contains("secer")
                || normalized.contains("mlijeko")
                || normalized.contains("ulje")
                || normalized.contains("detergent");
    }

    private LocalDate resolveDocumentDate(
            String rawText,
            LocalDate analyzerDate,
            BigDecimal analyzerDateConfidence,
            String providedValue
    ) {
        LocalDate providedDate = parseProvidedDate(providedValue);
        if (providedDate != null) {
            return providedDate;
        }

        if (analyzerDate != null) {
            return analyzerDate;
        }

        if (analyzerDate == null) {
            return parseCroatianDateFromText(rawText);
        }

        return null;
    }

    private boolean isDocumentDateAutoAccepted(BigDecimal confidence) {
        return confidence == null || confidence.compareTo(DOCUMENT_DATE_AUTO_ACCEPT_CONFIDENCE) >= 0;
    }

    private LocalDate parseProvidedDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        LocalDate croatianDate = parseCroatianDateFromText(value);
        if (croatianDate != null) {
            return croatianDate;
        }

        return LocalDate.parse(value.trim());
    }

    private LocalDate parseCroatianDateFromText(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }

        String cleanedText = text.lines()
                .filter(line -> !looksLikeScannerChrome(line))
                .reduce("", (acc, line) -> acc + "\n" + line);

        Matcher matcher = CROATIAN_DATE_PATTERN.matcher(cleanedText);

        while (matcher.find()) {
            try {
                int day = Integer.parseInt(matcher.group(1));
                int month = Integer.parseInt(matcher.group(2));
                int year = Integer.parseInt(matcher.group(3));

                if (year < 2020 || year > 2035) {
                    continue;
                }

                return LocalDate.of(year, month, day);
            } catch (DateTimeException | NumberFormatException ignored) {
            }
        }

        return null;
    }

    private List<String> mergeWarnings(
            List<String> parsedWarnings,
            DispatchSlipAnalyzerResponseDTO analysis,
            LocalDate resolvedDocumentDate,
            String providedDocumentDate
    ) {
        List<String> warnings = new ArrayList<>();

        if (analysis != null && analysis.getWarnings() != null) {
            warnings.addAll(analysis.getWarnings().stream()
                    .map(this::translateAnalyzerWarning)
                    .toList());
        }

        if (parsedWarnings != null) {
            warnings.addAll(parsedWarnings);
        }

        if (analysis != null && hasSuspiciousInvalidAnalyzerPartnerNumber(analysis.getPartnerNumber())) {
            warnings.add("Prepoznati broj partnera je odbačen jer nije valjan.");
        }

        if (analysis != null
                && analysis.getDocumentDate() != null
                && resolvedDocumentDate == null
                && (providedDocumentDate == null || providedDocumentDate.isBlank())
                && !isDocumentDateAutoAccepted(analysis.getDocumentDateConfidence())) {
            warnings.add("Prepoznati datum nije dovoljno siguran. Odaberi datum ručno.");
        }

        return warnings.stream()
                .filter(Objects::nonNull)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
    }

    private String translateAnalyzerWarning(String warning) {
        if (warning == null) {
            return null;
        }

        String text = warning.trim();
        String lower = text.toLowerCase();

        if (lower.equals("no quantities detected.")) {
            return "Količine nisu prepoznate.";
        }

        if (lower.contains("quantities have low confidence")) {
            String count = text.replaceAll("^([0-9]+).*$", "$1");
            return count.matches("[0-9]+")
                    ? count + " količina ima nisku sigurnost i treba ih provjeriti."
                    : "Neke količine imaju nisku sigurnost i treba ih provjeriti.";
        }

        if (lower.equals("partner was not detected.")) {
            return "Partner nije prepoznat.";
        }

        if (lower.equals("document date was not detected.")) {
            return "Datum dokumenta nije prepoznat.";
        }

        if (lower.contains("paper outline") || lower.contains("align the slip")) {
            return "Papir nije sigurno prepoznat. Poravnaj otpremnicu unutar okvira za bolje očitanje.";
        }

        if (lower.contains("image is blurry")) {
            return "Slika je mutna. Ponovno slikaj bliže i oštrije.";
        }

        if (lower.contains("image is too dark")) {
            return "Slika je pretamna.";
        }

        return text;
    }

    private Integer parsePositiveInt(String value) {
        if (value == null || !value.trim().matches("\\d{1,10}")) {
            return null;
        }

        try {
            int parsed = Integer.parseInt(value.trim());
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String normalizeSlipCode(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String normalized = ItemCodeUtil.normalize(value);
        if (normalized == null || normalized.isBlank()) {
            return null;
        }

        if (normalized.matches("\\d{1,4}")) {
            return "%04d".formatted(Integer.parseInt(normalized));
        }

        return normalized;
    }

    private boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
