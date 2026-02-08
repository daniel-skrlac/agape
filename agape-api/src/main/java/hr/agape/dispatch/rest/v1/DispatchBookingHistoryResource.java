package hr.agape.dispatch.rest.v1;

import hr.agape.common.constant.Roles;
import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.dispatch.dto.*;
import hr.agape.dispatch.enumeration.DispatchBookingStatus;
import hr.agape.dispatch.service.DispatchBookingHistoryService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import java.time.LocalDate;

@Path("/api/v1/dispatch/bookings")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed(Roles.USER)
public class DispatchBookingHistoryResource {

    @Inject
    DispatchBookingHistoryService service;

    @GET
    public ServiceResponseDTO<PagedResultDTO<DispatchBookingListItemDTO>> page(
            @QueryParam("warehouseId") Long warehouseId,
            @QueryParam("q") String q,
            @QueryParam("documentCode") String documentCode,
            @QueryParam("status") @DefaultValue("ALL") DispatchBookingStatus status,
            @QueryParam("dateFrom") String dateFrom,
            @QueryParam("dateTo") String dateTo,
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("20") int size
    ) {
        DispatchBookingsQueryDTO req = DispatchBookingsQueryDTO.builder()
                .warehouseId(warehouseId)
                .q(q)
                .documentCode(documentCode)
                .status(status)
                .dateFrom(parseDate(dateFrom))
                .dateTo(parseDate(dateTo))
                .page(page)
                .size(size)
                .build();

        return service.page(req);
    }

    @GET
    @Path("/{headerId}")
    public ServiceResponseDTO<DispatchBookingDetailDTO> detail(@PathParam("headerId") Long headerId) {
        return service.detail(headerId);
    }

    private static LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        return LocalDate.parse(s.trim());
    }
}
