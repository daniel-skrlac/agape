package hr.agape.dispatch.service;

import hr.agape.document.lookup.view.DocumentSlotTypeView;
import hr.agape.document.repository.DocumentTypeRepository;
import hr.agape.stock.repository.PendingStockRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

@ApplicationScoped
public class DraftPendingStockService {

    private final DocumentTypeRepository docTypeRepo;
    private final PendingStockRepository pendingRepo;

    @Inject
    public DraftPendingStockService(DocumentTypeRepository docTypeRepo, PendingStockRepository pendingRepo) {
        this.docTypeRepo = docTypeRepo;
        this.pendingRepo = pendingRepo;
    }

    // Draft create: add pending
    public void addDraftPending(Long documentId, Map<Long, BigDecimal> qtyByArtiklId) throws Exception {
        if (documentId == null || qtyByArtiklId == null || qtyByArtiklId.isEmpty()) return;

        DocumentSlotTypeView slot = docTypeRepo.findDocumentSlot(documentId).orElse(null);
        if (slot == null) return;

        int inOut = nz(slot.getInOutFlag());
        int changesStock = nz(slot.getChangesStock());
        if (changesStock <= 0) return; // legacy: pending only for MIJENJAZALIHU>0

        Map<Long, BigDecimal> delta = normalize(qtyByArtiklId);

        if (inOut == 4) pendingRepo.applyPendingOutDelta(delta);
        else pendingRepo.applyPendingInDelta(delta);
    }

    // Draft update: apply delta = new - old
    public void adjustDraftPending(Long documentId, Map<Long, BigDecimal> oldQty, Map<Long, BigDecimal> newQty) throws Exception {
        if (documentId == null) return;

        DocumentSlotTypeView slot = docTypeRepo.findDocumentSlot(documentId).orElse(null);
        if (slot == null) return;

        int inOut = nz(slot.getInOutFlag());
        int changesStock = nz(slot.getChangesStock());
        if (changesStock <= 0) return;

        Map<Long, BigDecimal> delta = diff(oldQty, newQty);
        if (delta.isEmpty()) return;

        if (inOut == 4) pendingRepo.applyPendingOutDelta(delta);
        else pendingRepo.applyPendingInDelta(delta);
    }

    // Draft cancel: remove all pending from that draft (apply -old)
    public void removeDraftPending(Long documentId, Map<Long, BigDecimal> oldQty) throws Exception {
        if (oldQty == null || oldQty.isEmpty()) return;

        Map<Long, BigDecimal> neg = new HashMap<>();
        for (var e : oldQty.entrySet()) {
            if (e.getKey() == null || e.getValue() == null) continue;
            if (e.getValue().signum() == 0) continue;
            neg.put(e.getKey(), e.getValue().negate());
        }
        addDraftPending(documentId, neg);
    }

    private static Map<Long, BigDecimal> normalize(Map<Long, BigDecimal> in) {
        Map<Long, BigDecimal> out = new HashMap<>();
        for (var e : in.entrySet()) {
            if (e.getKey() == null || e.getValue() == null) continue;
            if (e.getValue().signum() == 0) continue;
            out.put(e.getKey(), e.getValue());
        }
        return out;
    }

    private static Map<Long, BigDecimal> diff(Map<Long, BigDecimal> oldQty, Map<Long, BigDecimal> newQty) {
        Map<Long, BigDecimal> out = new HashMap<>();
        if (oldQty == null) oldQty = Map.of();
        if (newQty == null) newQty = Map.of();

        var keys = new java.util.HashSet<Long>();
        keys.addAll(oldQty.keySet());
        keys.addAll(newQty.keySet());

        for (Long k : keys) {
            if (k == null) continue;
            BigDecimal o = oldQty.getOrDefault(k, BigDecimal.ZERO);
            BigDecimal n = newQty.getOrDefault(k, BigDecimal.ZERO);
            BigDecimal d = n.subtract(o);
            if (d.signum() != 0) out.put(k, d);
        }
        return out;
    }

    private static int nz(Integer v) { return v == null ? 0 : v; }
}
