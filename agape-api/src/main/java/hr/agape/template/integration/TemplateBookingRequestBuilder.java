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
            List<TemplateBookDocPatchDTO> docPatches,
            List<TemplateBookItemDTO> extraItems,
            DispatchTemplateEntity template
    ) {
        List<DispatchTemplateDocEntity> docs = sortedDocs(template);
        Long firstDocId = resolveFirstDocId(docs);
        Map<Long, TemplateBookDocPatchDTO> patchByDocId = mapPatchesByDocId(docPatches);

        List<DispatchRequestDTO> out = new ArrayList<>();

        for (DispatchTemplateDocEntity doc : docs) {
            validateTemplateDocHasItems(doc);

            TemplateBookDocPatchDTO patch = patchByDocId.get(doc.getDocumentId());
            Map<Long, BigDecimal> qtyByItemId = buildBaseQtyMap(doc);

            applyPatchAddItems(qtyByItemId, patch);
            applyExtraItemsToFirstDoc(qtyByItemId, doc, firstDocId, extraItems);

            if (qtyByItemId.isEmpty()) {
                throw new IllegalArgumentException("Document " + doc.getDocumentId() + " has no items after overrides.");
            }

            out.add(toDispatchRequest(
                    warehouseId,
                    partnerId,
                    draft,
                    doc,
                    patch,
                    qtyByItemId
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

    private void validateTemplateDocHasItems(DispatchTemplateDocEntity doc) {
        if (doc.getItems() == null || doc.getItems().isEmpty()) {
            throw new IllegalArgumentException("Template document " + doc.getDocumentId() + " has no items.");
        }
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

    private DispatchRequestDTO toDispatchRequest(
            Long warehouseId,
            Long partnerId,
            boolean draft,
            DispatchTemplateDocEntity doc,
            TemplateBookDocPatchDTO patch,
            Map<Long, BigDecimal> qtyByItemId
    ) {
        DispatchRequestDTO dr = new DispatchRequestDTO();
        dr.setDocumentId(doc.getDocumentId());
        dr.setPartnerId(partnerId);
        dr.setWarehouseId(warehouseId);
        dr.setDraft(draft);

        // keeping your current behavior:
        // default note is applied only when patch for doc exists
        dr.setNote(resolveNote(doc, patch));

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

    private String resolveNote(DispatchTemplateDocEntity doc, TemplateBookDocPatchDTO patch) {
        if (patch != null && doc.getDefaultNote() != null) {
            return doc.getDefaultNote();
        }
        return null;
    }
}