package hr.agape.template.resource;

import hr.agape.common.constant.Roles;
import hr.agape.common.response.Responses;
import hr.agape.template.dto.BookingSessionCreateRequestDTO;
import hr.agape.template.dto.BookingSessionEntryUpsertRequestDTO;
import hr.agape.template.service.DispatchBookingSessionService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/dispatch-booking-sessions")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RequestScoped
@RolesAllowed(Roles.USER)
public class DispatchBookingSessionResource {

    private final DispatchBookingSessionService service;

    @Inject
    public DispatchBookingSessionResource(DispatchBookingSessionService service) {
        this.service = service;
    }

    @GET
    public Response list(@QueryParam("status") String status) {
        return Responses.from(service.listSessions(status));
    }

    @POST
    public Response create(@Valid BookingSessionCreateRequestDTO req) {
        return Responses.from(service.createSession(req));
    }

    @GET
    @Path("/{id}")
    public Response get(@PathParam("id") Long id) {
        return Responses.from(service.getSession(id));
    }

    @PUT
    @Path("/{id}/entries")
    public Response upsertEntry(@PathParam("id") Long sessionId, @Valid BookingSessionEntryUpsertRequestDTO req) {
        return Responses.from(service.upsertEntry(sessionId, req));
    }

    @DELETE
    @Path("/{id}/entries/{partnerId}")
    public Response deleteEntry(@PathParam("id") Long sessionId, @PathParam("partnerId") Long partnerId) {
        return Responses.from(service.removeEntry(sessionId, partnerId));
    }

    @POST
    @Path("/{id}/finalize")
    public Response finalize(@PathParam("id") Long sessionId) {
        return Responses.from(service.finalizeSession(sessionId));
    }

    @POST
    @Path("/{id}/cancel")
    public Response cancel(@PathParam("id") Long sessionId) {
        return Responses.from(service.cancelSession(sessionId));
    }
}
