package agapi.dispatch.rest.v1;

import agapi.common.response.Responses;
import agapi.dispatch.dto.DispatchNoteRequestDTO;
import agapi.dispatch.service.DispatchBookingService;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
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

    @POST
    public Response bookOne(@Valid DispatchNoteRequestDTO request) {
        return Responses.from(service.bookOne(request));
    }

    @POST
    @Path("/bulk")
    public Response bookBulkAtomic(@Valid List<DispatchNoteRequestDTO> requests) {
        return Responses.from(service.bookBulkAtomic(requests));
    }
}
