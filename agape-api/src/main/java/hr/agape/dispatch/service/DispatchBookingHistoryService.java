package hr.agape.dispatch.service;

import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchBookingDetailDTO;
import hr.agape.dispatch.dto.DispatchBookingListItemDTO;
import hr.agape.dispatch.dto.DispatchBookingsQueryDTO;
import hr.agape.dispatch.repository.DispatchBookingRepository;
import hr.agape.document.repository.DocumentSlotRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class DispatchBookingHistoryService {

    private final DispatchBookingRepository repo;
    private final DocumentSlotRepository slotRepo;

    @Inject
    public DispatchBookingHistoryService(DispatchBookingRepository repo, DocumentSlotRepository slotRepo) {
        this.repo = repo;
        this.slotRepo = slotRepo;
    }

    /**
     * Paged history of booked dispatch documents for a warehouse.
     * Currently limited to the dispatch document resolved for the warehouse (OTPREMNICA flow).
     */
    public ServiceResponseDTO<PagedResultDTO<DispatchBookingListItemDTO>> page(DispatchBookingsQueryDTO q) {
        try {
            if (q == null) return ServiceResponseDirector.errorBadRequest("request is null");
            if (q.getWarehouseId() == null) return ServiceResponseDirector.errorBadRequest("warehouseId missing");

            Long whId = q.getWarehouseId();

            // Resolve dispatch documentId for this warehouse (your existing OTPREMNICA mapping)
            Long documentId = slotRepo.resolveDispatchDocumentIdForWarehouse(whId);
            if (documentId == null) {
                return ServiceResponseDirector.errorBadRequest("Cannot resolve dispatch documentId for warehouseId=" + whId);
            }

            var res = repo.pageBookings(whId, documentId, q);
            return ServiceResponseDirector.successOk(res, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Page failed: " + safeMsg(e));
        }
    }

    /**
     * Loads one booking (header + items) by SD_GLAVA.ID
     */
    public ServiceResponseDTO<DispatchBookingDetailDTO> detail(Long headerId) {
        try {
            if (headerId == null) return ServiceResponseDirector.errorBadRequest("headerId missing");
            DispatchBookingDetailDTO d = repo.getBookingDetail(headerId);
            if (d == null) return ServiceResponseDirector.errorNotFound("Not found");
            return ServiceResponseDirector.successOk(d, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Detail failed: " + safeMsg(e));
        }
    }

    private static String safeMsg(Throwable t) {
        if (t == null) return "";
        return (t.getMessage() != null) ? t.getMessage() : t.toString();
    }
}
