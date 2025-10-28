package hr.agape.dispatch.rest.v1;

import hr.agape.common.response.Responses;
import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.dto.DispatchSearchFilter;
import hr.agape.dispatch.dto.DispatchUpdateRequestDTO;
import hr.agape.dispatch.service.DispatchBookingService;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.BeanParam;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;

@Path("/api/v1/dispatch")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RequestScoped
public class DispatchNoteResource {

    private final DispatchBookingService service;

    @Inject
    public DispatchNoteResource(DispatchBookingService service) {
        this.service = service;
    }

    @GET
    public Response search(@BeanParam @Valid DispatchSearchFilter filter) {
        return Responses.from(service.searchDispatches(filter));
    }

    @POST
    public Response bookOne(@Valid DispatchRequestDTO request) {
        return Responses.from(service.bookOne(request));
    }

    @POST
    @Path("/bulk")
    public Response bookBulkAtomic(@Valid List<DispatchRequestDTO> requests) {
        return Responses.from(service.bookBulk(requests));
    }

    @PUT
    @Path("/{id}")
    public Response updateOne(
            @PathParam("id") Long headerId,
            @Valid DispatchUpdateRequestDTO body
    ) {
        return Responses.from(service.updateDispatch(headerId, body));
    }
}
