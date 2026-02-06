package hr.agape.dispatch.service;

import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchRequestDTO;
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
     * Legacy-accurate validate for booking impact in ONE warehouse (current warehouse).
     * This system currently supports booking only OTPREMNICA (dispatch).
     * IMPORTANT: Legacy draft does NOT necessarily use "reservations".
     * Draft/unposted documents affect availability via SKL_APROMETI:
     * - ZALIHANEPROKNJIZENA (pending OUT)
     * - ZALIHAKALKULACIJA   (pending IN)
     * Effective availability shown to the user:
     * effective = current - pendingOut + pendingIn
     * Draft behavior (matches legacy ZBROJI_NEPROK_ZALIHU filter):
     * Applies only when SD_SIFREZ.MIJENJAZALIHU > 0.
     * OUT (ULAZIZLAZ=4): pendingOut += qty
     * IN  (else):        pendingIn  += qty
     * Posting is done by PL/SQL procedure (KNJIZI_MK) and is NOT simulated here.
     */
    public ServiceResponseDTO<WarehouseBookingImpactDTO> validate(DispatchRequestDTO req) {
        try {
            if (req == null) return ServiceResponseDirector.errorBadRequest("request is null");
            if (req.getWarehouseId() == null) return ServiceResponseDirector.errorBadRequest("warehouseId missing");
            if (req.getItems() == null || req.getItems().isEmpty())
                return ServiceResponseDirector.errorBadRequest("items missing");

            Long whId = req.getWarehouseId();

            // Resolve OTPREMNICA doc for this warehouse
            Long documentId = slotRepo.resolveDispatchDocumentIdForWarehouse(whId);
            if (documentId == null) {
                return ServiceResponseDirector.errorBadRequest("Cannot resolve DOKUMENT_ID for warehouseId=" + whId);
            }

            DocumentSlotTypeView slot = docTypeRepo.findDocumentSlot(documentId).orElse(null);
            if (slot == null) return ServiceResponseDirector.errorBadRequest("Unknown documentId=" + documentId);

            int inOut = nz(slot.getInOutFlag());           // OTPREMNICA expected 4
            int changesStock = nz(slot.getChangesStock()); // MIJENJAZALIHU (controls draft pending)

            boolean draft = req.isDraft();
            boolean willAffectPending = draft && changesStock > 0;

            // Sum quantities per ARTIKL_ID
            Map<Long, BigDecimal> qtyByArtiklId = new LinkedHashMap<>();
            for (DispatchRequestDTO.DispatchItemRequest it : req.getItems()) {
                if (it == null || it.getItemId() == null || it.getQuantity() == null) continue;
                BigDecimal q = BigDecimal.valueOf(it.getQuantity());
                if (q.signum() <= 0) continue;
                qtyByArtiklId.merge(it.getItemId(), q, BigDecimal::add);
            }
            if (qtyByArtiklId.isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("No valid quantities > 0");
            }

            // Load snapshot for this warehouse (joins SKL_ARTIKLIG and SKL_APROMETI)
            Map<Long, StockItemStatus> snap = stockRepo.loadForWarehouse(whId, qtyByArtiklId.keySet());

            List<BookingImpactItemDTO> items = new ArrayList<>(qtyByArtiklId.size());

            for (var e : qtyByArtiklId.entrySet()) {
                Long artiklId = e.getKey();
                BigDecimal qty = bd(e.getValue());

                StockItemStatus s = snap.get(artiklId);

                BigDecimal cur = bd(s == null ? null : s.getCurrentQty());
                BigDecimal pendOut = bd(s == null ? null : s.getPendingOutQty());
                BigDecimal pendIn = bd(s == null ? null : s.getPendingInQty());

                BigDecimal effective = cur.subtract(pendOut).add(pendIn);

                BigDecimal deltaPendOut = BigDecimal.ZERO;
                BigDecimal deltaPendIn = BigDecimal.ZERO;

                if (willAffectPending) {
                    if (inOut == 4) {
                        // OUT => pending OUT increases
                        deltaPendOut = qty;
                    } else {
                        // IN => pending IN increases
                        deltaPendIn = qty;
                    }
                }

                BigDecimal afterPendOut = pendOut.add(deltaPendOut);
                BigDecimal afterPendIn = pendIn.add(deltaPendIn);
                BigDecimal afterEffective = cur.subtract(afterPendOut).add(afterPendIn);

                items.add(BookingImpactItemDTO.builder()
                        .itemId(artiklId)
                        .itemCode(s == null ? null : s.getItemCode())
                        .name(s == null ? null : s.getName())
                        .unit(s == null ? null : s.getUnit())
                        .currentQty(cur)
                        .pendingOutQty(pendOut)
                        .pendingInQty(pendIn)
                        .effectiveQty(effective)
                        .deltaPendingOutQty(deltaPendOut)
                        .deltaPendingInQty(deltaPendIn)
                        .afterPendingOutQty(afterPendOut)
                        .afterPendingInQty(afterPendIn)
                        .afterEffectiveQty(afterEffective)
                        .missingInWarehouse(s == null)
                        .build());
            }

            WarehouseBookingImpactDTO out = WarehouseBookingImpactDTO.builder()
                    .warehouseId(whId)
                    .documentId(documentId)
                    .documentCode(slot.getDocumentCode())
                    .inOutFlag(inOut)
                    .changesStock(changesStock)
                    .draft(draft)
                    .willAffectPending(willAffectPending)
                    .items(items)
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

    private static String safeMsg(Throwable t) {
        if (t == null) return "";
        return t.getMessage() != null ? t.getMessage() : t.toString();
    }
}
