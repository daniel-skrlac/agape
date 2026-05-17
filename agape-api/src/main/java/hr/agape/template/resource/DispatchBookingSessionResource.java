package hr.agape.template.resource;

import hr.agape.common.constant.Roles;
import hr.agape.common.response.Responses;
import hr.agape.dispatch.scan.dto.BookingSessionScanEntryUpsertRequestDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanValidateRequestDTO;
import hr.agape.dispatch.scan.service.BookingSessionScanEntryService;
import hr.agape.template.dto.BookingSessionCreateRequestDTO;
import hr.agape.template.dto.BookingSessionEntryUpsertRequestDTO;
import hr.agape.template.dto.BookingSessionsQueryDTO;
import hr.agape.template.service.DispatchBookingSessionService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.BeanParam;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

@Path("/api/v1/dispatch-booking-sessions")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RequestScoped
@RolesAllowed(Roles.USER)
public class DispatchBookingSessionResource {

    private final DispatchBookingSessionService service;
    private final BookingSessionScanEntryService scanEntryService;

    @Inject
    public DispatchBookingSessionResource(
            DispatchBookingSessionService service,
            BookingSessionScanEntryService scanEntryService
    ) {
        this.service = service;
        this.scanEntryService = scanEntryService;
    }

    @GET
    public Response list(@BeanParam @Valid BookingSessionsQueryDTO query) {
        return Responses.from(service.listSessions(query));
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
    public Response upsertEntry(
            @PathParam("id") Long sessionId,
            @Valid BookingSessionEntryUpsertRequestDTO req
    ) {
        return Responses.from(service.upsertEntry(sessionId, req));
    }

    @POST
    @Path("/{id}/entries/scan/parse")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response parseScanEntry(
            @PathParam("id") Long sessionId,
            @RestForm("file") FileUpload file,
            @RestForm("partnerId") Long partnerId,
            @RestForm("templateId") Long templateId,
            @RestForm("documentDate") String documentDate,
            @RestForm("note") String note
    ) {
        return Responses.from(scanEntryService.parseScanUpload(
                sessionId,
                file,
                partnerId,
                templateId,
                documentDate,
                note
        ));
    }

    @POST
    @Path("/{id}/entries/scan/validate")
    public Response validateScanEntry(
            @PathParam("id") Long sessionId,
            @Valid BookingSessionScanValidateRequestDTO req
    ) {
        return Responses.from(scanEntryService.validateScanEntry(sessionId, req));
    }

    @PUT
    @Path("/{id}/entries/scan")
    public Response upsertScanEntry(
            @PathParam("id") Long sessionId,
            @Valid BookingSessionScanEntryUpsertRequestDTO req
    ) {
        return Responses.from(scanEntryService.upsertScanEntry(sessionId, req));
    }

    @DELETE
    @Path("/{id}/entries/{partnerId}")
    public Response deleteEntry(
            @PathParam("id") Long sessionId,
            @PathParam("partnerId") Long partnerId
    ) {
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

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        return Responses.from(service.deleteSession(id));
    }
}
