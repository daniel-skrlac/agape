package hr.agape.template.integration;

import hr.agape.document.lookup.view.DocumentSlotTypeView;
import hr.agape.document.repository.DocumentTypeRepository;
import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.template.domain.DispatchTemplateDocEntity;
import hr.agape.template.domain.DispatchTemplateDocItemEntity;
import hr.agape.template.domain.DispatchTemplateEntity;
import hr.agape.template.dto.TemplateBookDocPatchDTO;
import hr.agape.template.dto.TemplateBookExtraDocDTO;
import hr.agape.template.dto.TemplateBookItemDTO;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class TemplateBookingRequestBuilder {

    private final DocumentTypeRepository documentTypeRepository;

    @Inject
    public TemplateBookingRequestBuilder(DocumentTypeRepository documentTypeRepository) {
        this.documentTypeRepository = documentTypeRepository;
    }

    public List<DispatchRequestDTO> buildRequestsForPartner(
            Long warehouseId,
            Long partnerId,
            boolean draft,
            LocalDate documentDate,
            String entryNote,
            List<TemplateBookDocPatchDTO> docPatches,
            List<TemplateBookItemDTO> extraItems,
            DispatchTemplateEntity template
    ) {
        return buildRequestsForPartner(
                warehouseId,
                partnerId,
                draft,
                documentDate,
                entryNote,
                docPatches,
                extraItems,
                List.of(),
                template
        );
    }

    public List<DispatchRequestDTO> buildRequestsForPartner(
            Long warehouseId,
            Long partnerId,
            boolean draft,
            LocalDate documentDate,
            String entryNote,
            List<TemplateBookDocPatchDTO> docPatches,
            List<TemplateBookItemDTO> extraItems,
            List<TemplateBookExtraDocDTO> extraDocs,
            DispatchTemplateEntity template
    ) {
        List<DispatchTemplateDocEntity> docs = sortedDocs(template);
        Long firstDocId = resolveFirstDocId(docs);
        Map<Long, TemplateBookDocPatchDTO> patchByDocId = mapPatchesByDocId(docPatches);
        Map<Long, ExtraDocGroup> extraDocByDocId = mapExtraDocsByDocumentId(extraDocs);
        Set<Long> templateDocumentIds = new LinkedHashSet<>();

        List<DispatchRequestDTO> out = new ArrayList<>();

        for (DispatchTemplateDocEntity doc : docs) {
            templateDocumentIds.add(doc.getDocumentId());
            TemplateBookDocPatchDTO patch = patchByDocId.get(doc.getDocumentId());
            ExtraDocGroup extraDoc = extraDocByDocId.get(doc.getDocumentId());
            Map<Long, BigDecimal> qtyByItemId = buildBaseQtyMap(doc);

            applyPatchSetItems(qtyByItemId, patch);
            applyPatchRemoveItems(qtyByItemId, patch);
            applyPatchAddItems(qtyByItemId, patch);
            applyExtraItemsToFirstDoc(qtyByItemId, doc, firstDocId, extraItems);
            applyExtraDocItems(qtyByItemId, extraDoc);

            if (qtyByItemId.isEmpty()) {
                throw new IllegalArgumentException("Document " + doc.getDocumentId() + " has no items after overrides.");
            }

            out.add(toDispatchRequest(
                    resolveWarehouseId(warehouseId, doc.getDocumentId()),
                    doc.getDocumentId(),
                    partnerId,
                    resolveDraft(draft, extraDoc),
                    documentDate,
                    resolveNote(entryNote, doc, extraDoc),
                    qtyByItemId
            ));
        }

        for (ExtraDocGroup group : extraDocByDocId.values()) {
            if (group == null || group.documentId() == null || templateDocumentIds.contains(group.documentId())) {
                continue;
            }

            if (group.qtyByItemId().isEmpty()) {
                continue;
            }

            out.add(toDispatchRequest(
                    resolveWarehouseId(warehouseId, group.documentId()),
                    group.documentId(),
                    partnerId,
                    resolveDraft(draft, group),
                    documentDate,
                    resolveNote(entryNote, null, group),
                    group.qtyByItemId()
            ));
        }

        return out;
    }

    public List<DispatchRequestDTO> buildExtraDocRequests(
            Long fallbackWarehouseId,
            Long partnerId,
            boolean draft,
            LocalDate documentDate,
            String entryNote,
            List<TemplateBookExtraDocDTO> extraDocs
    ) {
        Map<Long, ExtraDocGroup> extraDocByDocId = mapExtraDocsByDocumentId(extraDocs);
        List<DispatchRequestDTO> out = new ArrayList<>();

        for (ExtraDocGroup group : extraDocByDocId.values()) {
            if (group == null || group.documentId() == null || group.qtyByItemId().isEmpty()) {
                continue;
            }

            out.add(toDispatchRequest(
                    resolveWarehouseId(fallbackWarehouseId, group.documentId()),
                    group.documentId(),
                    partnerId,
                    resolveDraft(draft, group),
                    documentDate,
                    resolveNote(entryNote, null, group),
                    group.qtyByItemId()
            ));
        }

        return out;
    }

    private List<DispatchTemplateDocEntity> sortedDocs(DispatchTemplateEntity template) {
        if (template == null || template.getDocuments() == null || template.getDocuments().isEmpty()) {
            return List.of();
        }

        return template.getDocuments().stream()
                .sorted(Comparator
                        .comparing(DispatchTemplateDocEntity::getSortOrder, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(DispatchTemplateDocEntity::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private Long resolveFirstDocId(List<DispatchTemplateDocEntity> docs) {
        if (docs.isEmpty()) return null;
        DispatchTemplateDocEntity first = docs.getFirst();
        return first == null ? null : first.getDocumentId();
    }

    private Map<Long, TemplateBookDocPatchDTO> mapPatchesByDocId(List<TemplateBookDocPatchDTO> docPatches) {
        return (docPatches == null ? List.<TemplateBookDocPatchDTO>of() : docPatches)
                .stream()
                .filter(p -> p.getDocumentId() != null)
                .collect(Collectors.toMap(
                        TemplateBookDocPatchDTO::getDocumentId,
                        p -> p,
                        (a, b) -> b // last wins
                ));
    }

    private Map<Long, ExtraDocGroup> mapExtraDocsByDocumentId(List<TemplateBookExtraDocDTO> extraDocs) {
        Map<Long, ExtraDocGroup> out = new LinkedHashMap<>();

        for (TemplateBookExtraDocDTO doc : extraDocs == null ? List.<TemplateBookExtraDocDTO>of() : extraDocs) {
            if (doc == null || doc.getDocumentId() == null) {
                continue;
            }

            ExtraDocGroup group = out.computeIfAbsent(
                    doc.getDocumentId(),
                    documentId -> new ExtraDocGroup(documentId, null, null, new LinkedHashMap<>())
            );

            if (doc.getDraft() != null) {
                group = group.withDraft(doc.getDraft());
            }
            if (doc.getNote() != null && !doc.getNote().isBlank()) {
                group = group.withNote(doc.getNote().trim());
            }

            out.put(doc.getDocumentId(), group);

            for (TemplateBookItemDTO item : doc.getItems() == null ? List.<TemplateBookItemDTO>of() : doc.getItems()) {
                mergeItem(group.qtyByItemId(), item);
            }
        }

        return out;
    }

    private Map<Long, BigDecimal> buildBaseQtyMap(DispatchTemplateDocEntity doc) {
        Map<Long, BigDecimal> qty = new LinkedHashMap<>();

        for (DispatchTemplateDocItemEntity item : doc.getItems()) {
            if (item == null || item.getItemId() == null || item.getQuantity() == null) {
                continue;
            }
            qty.put(item.getItemId(), item.getQuantity());
        }

        return qty;
    }

    private void applyPatchAddItems(Map<Long, BigDecimal> qtyByItemId, TemplateBookDocPatchDTO patch) {
        if (patch == null || patch.getAddItems() == null) return;

        for (TemplateBookItemDTO item : patch.getAddItems()) {
            mergeItem(qtyByItemId, item);
        }
    }

    private void applyPatchSetItems(Map<Long, BigDecimal> qtyByItemId, TemplateBookDocPatchDTO patch) {
        if (patch == null || patch.getSetItems() == null) return;

        qtyByItemId.clear();
        for (TemplateBookItemDTO item : patch.getSetItems()) {
            putExactItem(qtyByItemId, item);
        }
    }

    private void applyPatchRemoveItems(Map<Long, BigDecimal> qtyByItemId, TemplateBookDocPatchDTO patch) {
        if (patch == null || patch.getRemoveItemIds() == null) return;

        for (Long itemId : patch.getRemoveItemIds()) {
            if (itemId != null) {
                qtyByItemId.remove(itemId);
            }
        }
    }

    private void applyExtraItemsToFirstDoc(
            Map<Long, BigDecimal> qtyByItemId,
            DispatchTemplateDocEntity currentDoc,
            Long firstDocId,
            List<TemplateBookItemDTO> extraItems
    ) {
        if (firstDocId == null || extraItems == null) return;
        if (!Objects.equals(currentDoc.getDocumentId(), firstDocId)) return;

        for (TemplateBookItemDTO item : extraItems) {
            mergeItem(qtyByItemId, item);
        }
    }

    private void applyExtraDocItems(Map<Long, BigDecimal> qtyByItemId, ExtraDocGroup extraDoc) {
        if (extraDoc == null || extraDoc.qtyByItemId() == null) {
            return;
        }

        for (Map.Entry<Long, BigDecimal> entry : extraDoc.qtyByItemId().entrySet()) {
            BigDecimal quantity = entry.getValue();
            if (entry.getKey() == null || quantity == null || quantity.signum() <= 0) {
                continue;
            }
            qtyByItemId.merge(entry.getKey(), quantity, BigDecimal::add);
        }
    }

    private void mergeItem(Map<Long, BigDecimal> qtyByItemId, TemplateBookItemDTO item) {
        if (item == null || item.getItemId() == null) return;

        BigDecimal qty = item.getQuantity();
        if (qty == null || qty.signum() == 0) return;

        qtyByItemId.merge(item.getItemId(), qty, BigDecimal::add);
    }

    private void putExactItem(Map<Long, BigDecimal> qtyByItemId, TemplateBookItemDTO item) {
        if (item == null || item.getItemId() == null) return;

        BigDecimal qty = item.getQuantity();
        if (qty == null || qty.signum() <= 0) return;

        qtyByItemId.put(item.getItemId(), qty);
    }

    private DispatchRequestDTO toDispatchRequest(
            Long warehouseId,
            Long documentId,
            Long partnerId,
            boolean draft,
            LocalDate documentDate,
            String note,
            Map<Long, BigDecimal> qtyByItemId
    ) {
        DispatchRequestDTO dr = new DispatchRequestDTO();
        dr.setDocumentId(documentId);
        dr.setPartnerId(partnerId);
        dr.setWarehouseId(warehouseId);
        dr.setDraft(draft);
        dr.setDocumentDate(documentDate);
        dr.setNote(note);

        List<DispatchRequestDTO.DispatchItemRequest> items = new ArrayList<>();
        for (Map.Entry<Long, BigDecimal> e : qtyByItemId.entrySet()) {
            DispatchRequestDTO.DispatchItemRequest line = new DispatchRequestDTO.DispatchItemRequest();
            line.setItemId(e.getKey());
            line.setQuantity(e.getValue().doubleValue());
            items.add(line);
        }
        dr.setItems(items);
        return dr;
    }

    private boolean resolveDraft(boolean defaultDraft, ExtraDocGroup extraDoc) {
        if (extraDoc != null && extraDoc.draft() != null) {
            return extraDoc.draft();
        }
        return defaultDraft;
    }

    private Long resolveWarehouseId(Long fallbackWarehouseId, Long documentId) {
        if (documentId == null) {
            return fallbackWarehouseId;
        }

        try {
            DocumentSlotTypeView slot = documentTypeRepository.findDocumentSlot(documentId).orElse(null);
            if (slot == null || slot.getWarehouseId() == null) {
                return fallbackWarehouseId;
            }
            return slot.getWarehouseId().longValue();
        } catch (SQLException e) {
            throw new IllegalArgumentException("Could not resolve warehouse for document " + documentId + ".");
        }
    }

    private String resolveNote(String entryNote, DispatchTemplateDocEntity doc, ExtraDocGroup extraDoc) {
        if (extraDoc != null && extraDoc.note() != null && !extraDoc.note().isBlank()) {
            return extraDoc.note().trim();
        }

        String n = entryNote == null ? null : entryNote.trim();
        if (n != null && !n.isEmpty()) {
            return n;
        }

        String def = doc == null ? null : doc.getDefaultNote();
        def = def == null ? null : def.trim();
        if (def != null && !def.isEmpty()) {
            return def;
        }

        return null;
    }

    private record ExtraDocGroup(
            Long documentId,
            Boolean draft,
            String note,
            Map<Long, BigDecimal> qtyByItemId
    ) {
        ExtraDocGroup withDraft(Boolean nextDraft) {
            return new ExtraDocGroup(documentId, nextDraft, note, qtyByItemId);
        }

        ExtraDocGroup withNote(String nextNote) {
            return new ExtraDocGroup(documentId, draft, nextNote, qtyByItemId);
        }
    }
}
