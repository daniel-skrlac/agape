package hr.agape.dispatch.service;

import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchRequestValidationDTO;
import hr.agape.document.lookup.view.DocumentSlotTypeView;
import hr.agape.document.repository.DocumentSlotRepository;
import hr.agape.document.repository.DocumentTypeRepository;
import hr.agape.stock.domain.StockItemStatus;
import hr.agape.stock.repository.StockSnapshotRepository;
import hr.agape.template.dto.BookingImpactItemDTO;
import hr.agape.template.dto.WarehouseBookingImpactDTO;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class DispatchBookingValidateService {

    private final DocumentSlotRepository slotRepo;
    private final DocumentTypeRepository docTypeRepo;
    private final StockSnapshotRepository stockRepo;

    @Inject
    public DispatchBookingValidateService(
            DocumentSlotRepository slotRepo,
            DocumentTypeRepository docTypeRepo,
            StockSnapshotRepository stockRepo
    ) {
        this.slotRepo = slotRepo;
        this.docTypeRepo = docTypeRepo;
        this.stockRepo = stockRepo;
    }

    /**
     * Preview (validate) BEFORE booking.
     * This method does NOT use SD_SIFREZ.MIJENJAZALIHU.
     * Rules applied:
     * - draft=true:
     * OUT (inOutFlag=4): pendingOut += qty
     * IN  (otherwise):   pendingIn  += qty
     * current/inQty/outQty unchanged
     * - draft=false (final/posted):
     * OUT (inOutFlag=4): current -= qty, outQty += qty
     * IN  (otherwise):   current += qty, inQty  += qty
     * pending unchanged
     * effective = current - pendingOut + pendingIn
     * Output is frontend-focused:
     * - Only fields that actually change are populated (before/delta/after)
     * - changedFields lists what changed for each item
     */
    public ServiceResponseDTO<WarehouseBookingImpactDTO> validate(DispatchRequestValidationDTO req) {
        try {
            if (req == null) return ServiceResponseDirector.errorBadRequest("request is null");
            if (req.getWarehouseId() == null) return ServiceResponseDirector.errorBadRequest("warehouseId missing");
            if (req.getItems() == null || req.getItems().isEmpty())
                return ServiceResponseDirector.errorBadRequest("items missing");

            final Long whId = req.getWarehouseId();

            // Resolve OTPREMNICA doc for this warehouse
            final Long documentId = slotRepo.resolveDispatchDocumentIdForWarehouse(whId);
            if (documentId == null) {
                return ServiceResponseDirector.errorBadRequest("Cannot resolve DOKUMENT_ID for warehouseId=" + whId);
            }

            final DocumentSlotTypeView slot = docTypeRepo.findDocumentSlot(documentId).orElse(null);
            if (slot == null) return ServiceResponseDirector.errorBadRequest("Unknown documentId=" + documentId);

            final int inOut = nz(slot.getInOutFlag()); // OTPREMNICA expected 4
            final boolean draft = req.isDraft();

            // Sum quantities per item (merge duplicates)
            final Map<Long, BigDecimal> qtyByItemId = new LinkedHashMap<>();
            for (DispatchRequestValidationDTO.DispatchItemValidationRequest it : req.getItems()) {
                if (it == null || it.getItemId() == null || it.getQuantity() == null) continue;
                BigDecimal q = BigDecimal.valueOf(it.getQuantity());
                if (q.signum() <= 0) continue;
                qtyByItemId.merge(it.getItemId(), q, BigDecimal::add);
            }
            if (qtyByItemId.isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("No valid quantities > 0");
            }

            // Load snapshot (current + pending + in/out counters)
            final Map<Long, StockItemStatus> snap = stockRepo.loadForWarehouse(whId, qtyByItemId.keySet());

            final List<BookingImpactItemDTO> outItems = new ArrayList<>(qtyByItemId.size());

            for (var e : qtyByItemId.entrySet()) {
                final Long itemId = e.getKey();
                final BigDecimal qty = bd(e.getValue());

                final StockItemStatus s = snap.get(itemId);

                final BigDecimal cur0 = bd(s == null ? null : s.getCurrentQty());
                final BigDecimal pendOut0 = bd(s == null ? null : s.getPendingOutQty());
                final BigDecimal pendIn0 = bd(s == null ? null : s.getPendingInQty());
                final BigDecimal in0 = bd(s == null ? null : s.getInQty());
                final BigDecimal out0 = bd(s == null ? null : s.getOutQty());

                final BigDecimal eff0 = cur0.subtract(pendOut0).add(pendIn0);

                // deltas from this request
                BigDecimal dCur = BigDecimal.ZERO;
                BigDecimal dPendOut = BigDecimal.ZERO;
                BigDecimal dPendIn = BigDecimal.ZERO;
                BigDecimal dIn = BigDecimal.ZERO;
                BigDecimal dOut = BigDecimal.ZERO;

                final boolean isOut = (inOut == 4);

                if (draft) {
                    // draft touches pending only
                    if (isOut) dPendOut = qty;
                    else dPendIn = qty;
                } else {
                    // posted touches current + IN/OUT counters
                    if (isOut) {
                        dCur = qty.negate();
                        dOut = qty;
                    } else {
                        dCur = qty;
                        dIn = qty;
                    }
                }

                final BigDecimal cur1 = cur0.add(dCur);
                final BigDecimal pendOut1 = pendOut0.add(dPendOut);
                final BigDecimal pendIn1 = pendIn0.add(dPendIn);
                final BigDecimal in1 = in0.add(dIn);
                final BigDecimal out1 = out0.add(dOut);

                final BigDecimal eff1 = cur1.subtract(pendOut1).add(pendIn1);

                // Only send what actually changed
                List<String> changed = new ArrayList<>(6);

                BookingImpactItemDTO.BookingImpactItemDTOBuilder b = BookingImpactItemDTO.builder()
                        .itemId(itemId)
                        .itemCode(s == null ? null : s.getItemCode())
                        .name(s == null ? null : s.getName())
                        .unit(s == null ? null : s.getUnit())
                        .missingInWarehouse(s == null)
                        .beforeEffectiveQty(eff0)
                        .afterEffectiveQty(eff1);

                if (neq(cur0, cur1)) {
                    changed.add("currentQty");
                    b.beforeCurrentQty(cur0).deltaCurrentQty(dCur).afterCurrentQty(cur1);
                }
                if (neq(pendOut0, pendOut1)) {
                    changed.add("pendingOutQty");
                    b.beforePendingOutQty(pendOut0).deltaPendingOutQty(dPendOut).afterPendingOutQty(pendOut1);
                }
                if (neq(pendIn0, pendIn1)) {
                    changed.add("pendingInQty");
                    b.beforePendingInQty(pendIn0).deltaPendingInQty(dPendIn).afterPendingInQty(pendIn1);
                }
                if (neq(in0, in1)) {
                    changed.add("inQty");
                    b.beforeInQty(in0).deltaInQty(dIn).afterInQty(in1);
                }
                if (neq(out0, out1)) {
                    changed.add("outQty");
                    b.beforeOutQty(out0).deltaOutQty(dOut).afterOutQty(out1);
                }

                b.changedFields(changed);
                outItems.add(b.build());
            }

            // You said: “only return values what really need frontend”
            // -> keep this header minimal too.
            WarehouseBookingImpactDTO out = WarehouseBookingImpactDTO.builder()
                    .warehouseId(whId)
                    .documentId(documentId)
                    .documentCode(slot.getDocumentCode())
                    .inOutFlag(inOut)
                    .draft(draft)
                    .items(outItems)
                    .build();

            return ServiceResponseDirector.successOk(out, "OK");
        } catch (Exception ex) {
            return ServiceResponseDirector.errorInternal("Validate failed: " + safeMsg(ex));
        }
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    private static BigDecimal bd(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static boolean neq(BigDecimal a, BigDecimal b) {
        return a.compareTo(b) != 0;
    }

    private static String safeMsg(Throwable t) {
        if (t == null) return "";
        return (t.getMessage() != null) ? t.getMessage() : t.toString();
    }
}
