package hr.agape.template.resource;

import hr.agape.common.constant.Roles;
import hr.agape.common.response.Responses;
import hr.agape.template.dto.TemplateBookManyRequestDTO;
import hr.agape.template.dto.TemplateBookOneRequestDTO;
import hr.agape.template.service.DispatchTemplateService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/dispatch-template-booking")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RequestScoped
@RolesAllowed(Roles.USER)
public class DispatchTemplateBookingResource {

    private final DispatchTemplateService service;

    @Inject
    public DispatchTemplateBookingResource(DispatchTemplateService service) {
        this.service = service;
    }

    @POST
    @Path("/")
    public Response bookOne(@Valid TemplateBookOneRequestDTO req) {
        return Responses.from(service.bookFromTemplateForOnePartner(req));
    }

    @POST
    @Path("/bulk")
    public Response bookMany(@Valid TemplateBookManyRequestDTO req) {
        return Responses.from(service.bookFromTemplateForManyPartners(req));
    }
}
