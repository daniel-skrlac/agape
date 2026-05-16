package hr.agape.dispatch.scan.util;

import hr.agape.dispatch.scan.dto.BookingSessionScanEntryUpsertRequestDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanLineDTO;
import hr.agape.template.dto.BookingSessionEntryUpsertRequestDTO;
import hr.agape.template.dto.TemplateBookDocPatchDTO;
import hr.agape.template.dto.TemplateBookItemDTO;
import hr.agape.template.enumeration.DraftMode;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class BookingSessionScanEntryUtil {

    private BookingSessionScanEntryUtil() {
    }

    public static BookingSessionEntryUpsertRequestDTO toEntryRequest(
            BookingSessionScanEntryUpsertRequestDTO req,
            String note
    ) {
        BookingSessionEntryUpsertRequestDTO dto = new BookingSessionEntryUpsertRequestDTO();
        dto.setPartnerId(req.getPartnerId());
        dto.setTemplateId(req.getTemplateId());
        dto.setDraftMode(req.getDraftMode() == null ? DraftMode.FINAL : req.getDraftMode());
        dto.setDocumentDate(req.getDocumentDate());
        dto.setDocPatches(buildDocPatches(req.getLines(), req.getTemplateId()));
        dto.setExtraItems(buildExtraItems(req.getLines(), req.getTemplateId()));
        dto.setNote(note);
        return dto;
    }

    public static List<TemplateBookDocPatchDTO> buildDocPatches(
            List<BookingSessionScanLineDTO> lines,
            Long templateId
    ) {
        if (templateId == null || lines == null || lines.isEmpty()) {
            return List.of();
        }

        Map<Long, Map<Long, TemplateBookItemDTO>> byDocumentAndItem = new LinkedHashMap<>();

        for (BookingSessionScanLineDTO line : lines) {
            if (line == null || line.getDocumentId() == null) {
                continue;
            }

            Map<Long, TemplateBookItemDTO> byItem = byDocumentAndItem.computeIfAbsent(
                    line.getDocumentId(),
                    key -> new LinkedHashMap<>()
            );

            TemplateBookItemDTO item = byItem.computeIfAbsent(line.getItemId(), itemId -> {
                TemplateBookItemDTO next = new TemplateBookItemDTO();
                next.setItemId(itemId);
                next.setQuantity(BigDecimal.ZERO);
                return next;
            });

            item.setQuantity(item.getQuantity().add(line.getQuantity()));
        }

        return byDocumentAndItem.entrySet().stream()
                .map(entry -> {
                    TemplateBookDocPatchDTO patch = new TemplateBookDocPatchDTO();
                    patch.setDocumentId(entry.getKey());
                    patch.setSetItems(new ArrayList<>(entry.getValue().values()));
                    return patch;
                })
                .toList();
    }

    public static List<TemplateBookItemDTO> buildExtraItems(
            List<BookingSessionScanLineDTO> lines,
            Long templateId
    ) {
        if (lines == null || lines.isEmpty()) {
            return List.of();
        }

        Map<Long, TemplateBookItemDTO> byItemId = new LinkedHashMap<>();

        for (BookingSessionScanLineDTO line : lines) {
            if (line == null) {
                continue;
            }

            boolean belongsToTemplateDocument = templateId != null && line.getDocumentId() != null;

            if (belongsToTemplateDocument) {
                continue;
            }

            TemplateBookItemDTO item = byItemId.computeIfAbsent(line.getItemId(), itemId -> {
                TemplateBookItemDTO next = new TemplateBookItemDTO();
                next.setItemId(itemId);
                next.setQuantity(BigDecimal.ZERO);
                return next;
            });

            item.setQuantity(item.getQuantity().add(line.getQuantity()));
        }

        return byItemId.values().stream().toList();
    }
}
