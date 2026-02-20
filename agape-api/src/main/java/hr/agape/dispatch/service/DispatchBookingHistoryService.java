package hr.agape.dispatch.service;

import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchBookingDetailDTO;
import hr.agape.dispatch.dto.DispatchBookingListItemDTO;
import hr.agape.dispatch.dto.DispatchBookingsQueryDTO;
import hr.agape.dispatch.repository.DispatchBookingRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class DispatchBookingHistoryService {

    private final DispatchBookingRepository repo;

    @Inject
    public DispatchBookingHistoryService(DispatchBookingRepository repo) {
        this.repo = repo;
    }


    public ServiceResponseDTO<PagedResultDTO<DispatchBookingListItemDTO>> page(DispatchBookingsQueryDTO q) {
        try {
            if (q == null) return ServiceResponseDirector.errorBadRequest("request is null");

            if (q.getDocumentCode() == null || q.getDocumentCode().trim().isEmpty()) {
                q.setDocumentCode("OTPREMNICA");
            }

            var res = repo.pageBookings(q);
            return ServiceResponseDirector.successOk(res, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Page failed: " + safeMsg(e));
        }
    }

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

