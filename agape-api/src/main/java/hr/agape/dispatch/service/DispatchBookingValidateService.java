package hr.agape.dispatch.service;

import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchBulkValidationItemDTO;
import hr.agape.dispatch.dto.DispatchBulkValidationRequestDTO;
import hr.agape.dispatch.dto.DispatchBulkValidationResponseDTO;
import hr.agape.dispatch.dto.DispatchBulkValidationRowDTO;
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
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

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
            if (req.getItems() == null || req.getItems().isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("items missing");
            }

            Map<Long, BigDecimal> qtyByItemId = normalizeQty(req);
            if (qtyByItemId.isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("No valid quantities > 0");
            }

            WarehouseValidationState state = initWarehouseState(req.getWarehouseId(), qtyByItemId.keySet());
            if (state.initError() != null) {
                return ServiceResponseDirector.errorBadRequest(state.initError());
            }

            WarehouseBookingImpactDTO out = calculateImpact(req, qtyByItemId, state, false);
            return ServiceResponseDirector.successOk(out, "OK");
        } catch (IllegalArgumentException e) {
            return ServiceResponseDirector.errorBadRequest(e.getMessage());
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Validate failed.");
        }
    }

    /**
     * CUMULATIVE bulk validation.
     * Requests are processed in the SAME ORDER as input.
     * Each next request for the same warehouse sees virtual stock state after previous requests.
     * partnerId is only correlation metadata for frontend/backend response mapping.
     * It is NOT used in stock calculation.
     */
    public ServiceResponseDTO<DispatchBulkValidationResponseDTO> validateBulk(DispatchBulkValidationRequestDTO req) {
        try {
            if (req == null || req.getItems() == null || req.getItems().isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("items missing");
            }

            List<DispatchBulkValidationItemDTO> input = req.getItems().stream()
                    .filter(Objects::nonNull)
                    .toList();

            if (input.isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("items missing");
            }

            List<PreparedBulkValidationItem> prepared = new ArrayList<>(input.size());
            Map<Long, LinkedHashSet<Long>> itemIdsByWarehouse = new LinkedHashMap<>();

            for (DispatchBulkValidationItemDTO item : input) {
                Map<Long, BigDecimal> qtyByItemId = normalizeQty(item.getRequest());
                if (qtyByItemId.isEmpty()) {
                    return ServiceResponseDirector.errorBadRequest("No valid quantities > 0 for partnerId=" + item.getPartnerId());
                }

                prepared.add(new PreparedBulkValidationItem(
                        item.getPartnerId(),
                        item.getRequest(),
                        qtyByItemId
                ));

                itemIdsByWarehouse
                        .computeIfAbsent(item.getRequest().getWarehouseId(), x -> new LinkedHashSet<>())
                        .addAll(qtyByItemId.keySet());
            }

            Map<Long, WarehouseValidationState> stateByWarehouse = new LinkedHashMap<>();
            for (Map.Entry<Long, LinkedHashSet<Long>> e : itemIdsByWarehouse.entrySet()) {
                stateByWarehouse.put(e.getKey(), initWarehouseState(e.getKey(), e.getValue()));
            }

            List<DispatchBulkValidationRowDTO> results = new ArrayList<>(prepared.size());

            for (PreparedBulkValidationItem item : prepared) {
                WarehouseValidationState state = stateByWarehouse.get(item.request().getWarehouseId());

                if (state == null) {
                    results.add(DispatchBulkValidationRowDTO.builder()
                            .partnerId(item.partnerId())
                            .data(null)
                            .error("Warehouse state not initialized.")
                            .build());
                    continue;
                }

                if (state.initError() != null) {
                    results.add(DispatchBulkValidationRowDTO.builder()
                            .partnerId(item.partnerId())
                            .data(null)
                            .error(state.initError())
                            .build());
                    continue;
                }

                try {
                    WarehouseBookingImpactDTO data = calculateImpact(
                            item.request(),
                            item.qtyByItemId(),
                            state,
                            true
                    );

                    results.add(DispatchBulkValidationRowDTO.builder()
                            .partnerId(item.partnerId())
                            .data(data)
                            .error(null)
                            .build());
                } catch (Exception ex) {
                    results.add(DispatchBulkValidationRowDTO.builder()
                            .partnerId(item.partnerId())
                            .data(null)
                            .error("Validate failed.")
                            .build());
                }
            }

            return ServiceResponseDirector.successOk(
                    DispatchBulkValidationResponseDTO.builder()
                            .results(results)
                            .build(),
                    "OK"
            );
        } catch (IllegalArgumentException e) {
            return ServiceResponseDirector.errorBadRequest(e.getMessage());
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Bulk validate failed.");
        }
    }

    private WarehouseValidationState initWarehouseState(Long warehouseId, Collection<Long> itemIds) {
        try {
            final Long documentId = slotRepo.resolveDispatchDocumentIdForWarehouse(warehouseId);
            if (documentId == null) {
                return WarehouseValidationState.error("Cannot resolve DOKUMENT_ID for warehouseId=" + warehouseId);
            }

            final DocumentSlotTypeView slot = docTypeRepo.findDocumentSlot(documentId).orElse(null);
            if (slot == null) {
                return WarehouseValidationState.error("Unknown documentId=" + documentId);
            }

            final Map<Long, StockItemStatus> snap = stockRepo.loadForWarehouse(warehouseId, itemIds);

            Map<Long, MutableStockItemState> mutable = new LinkedHashMap<>();
            for (Long itemId : itemIds) {
                StockItemStatus s = snap.get(itemId);
                mutable.put(itemId, MutableStockItemState.from(itemId, s));
            }

            return WarehouseValidationState.ok(warehouseId, documentId, slot, mutable);
        } catch (Exception e) {
            return WarehouseValidationState.error("Failed to initialize warehouse validation.");
        }
    }

    private WarehouseBookingImpactDTO calculateImpact(
            DispatchRequestValidationDTO req,
            Map<Long, BigDecimal> qtyByItemId,
            WarehouseValidationState state,
            boolean apply
    ) {
        final int inOut = nz(state.slot().getInOutFlag());
        final boolean draft = req.isDraft();

        final List<BookingImpactItemDTO> outItems = new ArrayList<>(qtyByItemId.size());

        for (var e : qtyByItemId.entrySet()) {
            final Long itemId = e.getKey();
            final BigDecimal qty = bd(e.getValue());

            final MutableStockItemState s = state.getOrCreate(itemId);

            final BigDecimal cur0 = bd(s.currentQty());
            final BigDecimal pendOut0 = bd(s.pendingOutQty());
            final BigDecimal pendIn0 = bd(s.pendingInQty());
            final BigDecimal in0 = bd(s.inQty());
            final BigDecimal out0 = bd(s.outQty());

            final BigDecimal eff0 = cur0.subtract(pendOut0).add(pendIn0);

            BigDecimal dCur = BigDecimal.ZERO;
            BigDecimal dPendOut = BigDecimal.ZERO;
            BigDecimal dPendIn = BigDecimal.ZERO;
            BigDecimal dIn = BigDecimal.ZERO;
            BigDecimal dOut = BigDecimal.ZERO;

            final boolean isOut = (inOut == 4);

            if (draft) {
                if (isOut) dPendOut = qty;
                else dPendIn = qty;
            } else {
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

            List<String> changed = new ArrayList<>(6);

            BookingImpactItemDTO.BookingImpactItemDTOBuilder b = BookingImpactItemDTO.builder()
                    .itemId(itemId)
                    .itemCode(s.itemCode())
                    .name(s.name())
                    .unit(s.unit())
                    .missingInWarehouse(s.missingInWarehouse())
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

            if (apply) {
                s.setCurrentQty(cur1);
                s.setPendingOutQty(pendOut1);
                s.setPendingInQty(pendIn1);
                s.setInQty(in1);
                s.setOutQty(out1);
            }
        }

        return WarehouseBookingImpactDTO.builder()
                .warehouseId(state.warehouseId())
                .documentId(state.documentId())
                .documentCode(state.slot().getDocumentCode())
                .inOutFlag(inOut)
                .draft(draft)
                .items(outItems)
                .build();
    }

    private Map<Long, BigDecimal> normalizeQty(DispatchRequestValidationDTO req) {
        final Map<Long, BigDecimal> qtyByItemId = new LinkedHashMap<>();

        for (DispatchRequestValidationDTO.DispatchItemValidationRequest it : req.getItems()) {
            if (it == null || it.getItemId() == null || it.getQuantity() == null) continue;

            BigDecimal q = BigDecimal.valueOf(it.getQuantity());
            if (q.signum() <= 0) continue;

            qtyByItemId.merge(it.getItemId(), q, BigDecimal::add);
        }

        return qtyByItemId;
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

    private record PreparedBulkValidationItem(
            Long partnerId,
            DispatchRequestValidationDTO request,
            Map<Long, BigDecimal> qtyByItemId
    ) {
    }

    private record WarehouseValidationState(Long warehouseId, Long documentId, DocumentSlotTypeView slot,
                                            Map<Long, MutableStockItemState> items, String initError) {

        static WarehouseValidationState ok(
                Long warehouseId,
                Long documentId,
                DocumentSlotTypeView slot,
                Map<Long, MutableStockItemState> items
        ) {
            return new WarehouseValidationState(warehouseId, documentId, slot, items, null);
        }

        static WarehouseValidationState error(String msg) {
            return new WarehouseValidationState(null, null, null, new LinkedHashMap<>(), msg);
        }

        MutableStockItemState getOrCreate(Long itemId) {
            return items.computeIfAbsent(itemId, MutableStockItemState::missing);
        }
    }

    private static final class MutableStockItemState {
        private final Long itemId;
        private final String itemCode;
        private final String name;
        private final String unit;
        private final boolean missingInWarehouse;

        private BigDecimal currentQty;
        private BigDecimal pendingOutQty;
        private BigDecimal pendingInQty;
        private BigDecimal inQty;
        private BigDecimal outQty;

        private MutableStockItemState(
                Long itemId,
                String itemCode,
                String name,
                String unit,
                boolean missingInWarehouse,
                BigDecimal currentQty,
                BigDecimal pendingOutQty,
                BigDecimal pendingInQty,
                BigDecimal inQty,
                BigDecimal outQty
        ) {
            this.itemId = itemId;
            this.itemCode = itemCode;
            this.name = name;
            this.unit = unit;
            this.missingInWarehouse = missingInWarehouse;
            this.currentQty = bd(currentQty);
            this.pendingOutQty = bd(pendingOutQty);
            this.pendingInQty = bd(pendingInQty);
            this.inQty = bd(inQty);
            this.outQty = bd(outQty);
        }

        static MutableStockItemState from(Long itemId, StockItemStatus s) {
            if (s == null) {
                return missing(itemId);
            }

            return new MutableStockItemState(
                    itemId,
                    s.getItemCode(),
                    s.getName(),
                    s.getUnit(),
                    false,
                    s.getCurrentQty(),
                    s.getPendingOutQty(),
                    s.getPendingInQty(),
                    s.getInQty(),
                    s.getOutQty()
            );
        }

        static MutableStockItemState missing(Long itemId) {
            return new MutableStockItemState(
                    itemId,
                    null,
                    null,
                    null,
                    true,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO
            );
        }

        @SuppressWarnings("unused")
        Long itemId() {
            return itemId;
        }

        String itemCode() {
            return itemCode;
        }

        String name() {
            return name;
        }

        String unit() {
            return unit;
        }

        boolean missingInWarehouse() {
            return missingInWarehouse;
        }

        BigDecimal currentQty() {
            return currentQty;
        }

        BigDecimal pendingOutQty() {
            return pendingOutQty;
        }

        BigDecimal pendingInQty() {
            return pendingInQty;
        }

        BigDecimal inQty() {
            return inQty;
        }

        BigDecimal outQty() {
            return outQty;
        }

        void setCurrentQty(BigDecimal v) {
            this.currentQty = bd(v);
        }

        void setPendingOutQty(BigDecimal v) {
            this.pendingOutQty = bd(v);
        }

        void setPendingInQty(BigDecimal v) {
            this.pendingInQty = bd(v);
        }

        void setInQty(BigDecimal v) {
            this.inQty = bd(v);
        }

        void setOutQty(BigDecimal v) {
            this.outQty = bd(v);
        }
    }
}