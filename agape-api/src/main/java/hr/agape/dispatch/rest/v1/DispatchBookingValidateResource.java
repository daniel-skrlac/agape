package hr.agape.dispatch.rest.v1;

import hr.agape.common.constant.Roles;
import hr.agape.common.response.Responses;
import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.service.DispatchBookingValidateService;
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

@Path("/api/v1/dispatch/validate")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RequestScoped
@RolesAllowed(Roles.USER)
public class DispatchBookingValidateResource {

    private final DispatchBookingValidateService service;

    @Inject
    public DispatchBookingValidateResource(DispatchBookingValidateService service) {
        this.service = service;
    }

    @POST
    public Response validate(@Valid DispatchRequestDTO req) {
        return Responses.from(service.validate(req));
    }
}
