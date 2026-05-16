package hr.agape.template.integration;

import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.template.domain.DispatchTemplateDocEntity;
import hr.agape.template.domain.DispatchTemplateDocItemEntity;
import hr.agape.template.domain.DispatchTemplateEntity;
import hr.agape.template.dto.TemplateBookDocPatchDTO;
import hr.agape.template.dto.TemplateBookItemDTO;
import jakarta.enterprise.context.ApplicationScoped;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@ApplicationScoped
public class TemplateBookingRequestBuilder {

    public List<DispatchRequestDTO> buildRequestsForPartner(
            Long warehouseId,
            Long partnerId,
            boolean draft,
            String entryNote,
            List<TemplateBookDocPatchDTO> docPatches,
            List<TemplateBookItemDTO> extraItems,
            DispatchTemplateEntity template
    ) {
        List<DispatchTemplateDocEntity> docs = sortedDocs(template);
        Long firstDocId = resolveFirstDocId(docs);
        Map<Long, TemplateBookDocPatchDTO> patchByDocId = mapPatchesByDocId(docPatches);

        List<DispatchRequestDTO> out = new ArrayList<>();

        for (DispatchTemplateDocEntity doc : docs) {
            TemplateBookDocPatchDTO patch = patchByDocId.get(doc.getDocumentId());
            Map<Long, BigDecimal> qtyByItemId = buildBaseQtyMap(doc);

            applyPatchSetItems(qtyByItemId, patch);
            applyPatchRemoveItems(qtyByItemId, patch);
            applyPatchAddItems(qtyByItemId, patch);
            applyExtraItemsToFirstDoc(qtyByItemId, doc, firstDocId, extraItems);

            if (qtyByItemId.isEmpty()) {
                throw new IllegalArgumentException("Document " + doc.getDocumentId() + " has no items after overrides.");
            }

            out.add(toDispatchRequest(warehouseId, partnerId, draft, entryNote, doc, qtyByItemId));
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
            Long partnerId,
            boolean draft,
            String entryNote,
            DispatchTemplateDocEntity doc,
            Map<Long, BigDecimal> qtyByItemId
    ) {
        DispatchRequestDTO dr = new DispatchRequestDTO();
        dr.setDocumentId(doc.getDocumentId());
        dr.setPartnerId(partnerId);
        dr.setWarehouseId(warehouseId);
        dr.setDraft(draft);

        dr.setNote(resolveNote(entryNote, doc));

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

    private String resolveNote(String entryNote, DispatchTemplateDocEntity doc) {
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
}
