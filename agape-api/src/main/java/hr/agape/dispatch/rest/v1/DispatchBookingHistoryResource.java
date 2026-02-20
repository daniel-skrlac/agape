package hr.agape.dispatch.rest.v1;

import hr.agape.common.constant.Roles;
import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.dispatch.dto.DispatchBookingDetailDTO;
import hr.agape.dispatch.dto.DispatchBookingListItemDTO;
import hr.agape.dispatch.dto.DispatchBookingsQueryDTO;
import hr.agape.dispatch.service.DispatchBookingHistoryService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.BeanParam;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;


@Path("/api/v1/dispatch/bookings")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed(Roles.USER)
public class DispatchBookingHistoryResource {

    @Inject
    DispatchBookingHistoryService service;

    @GET
    public ServiceResponseDTO<PagedResultDTO<DispatchBookingListItemDTO>> page(
            @BeanParam @Valid @NotNull DispatchBookingsQueryDTO dispatchBookingsQueryDTO
    ) {
        return service.page(dispatchBookingsQueryDTO);
    }

    @GET
    @Path("/{headerId}")
    public ServiceResponseDTO<DispatchBookingDetailDTO> detail(@PathParam("headerId") Long headerId) {
        return service.detail(headerId);
    }
}
