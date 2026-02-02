package hr.agape.template.resource;

import hr.agape.common.constant.Roles;
import hr.agape.common.response.Responses;
import hr.agape.template.dto.TemplateCopyRequestDTO;
import hr.agape.template.dto.TemplateShareCreateRequestDTO;
import hr.agape.template.service.DispatchTemplateService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/dispatch-templates")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RequestScoped
@RolesAllowed(Roles.USER)
public class DispatchTemplateShareResource {

    private final DispatchTemplateService service;

    @Inject
    public DispatchTemplateShareResource(DispatchTemplateService service) {
        this.service = service;
    }

    @POST
    @Path("/{id}/shares")
    public Response share(@PathParam("id") Long templateId, @Valid TemplateShareCreateRequestDTO req) {
        return Responses.from(service.shareTemplate(templateId, req));
    }

    @GET
    @Path("/{id}/shares")
    public Response listShares(@PathParam("id") Long templateId) {
        return Responses.from(service.listShares(templateId));
    }

    @DELETE
    @Path("/{id}/shares/{shareId}")
    public Response revoke(@PathParam("id") Long templateId, @PathParam("shareId") Long shareId) {
        return Responses.from(service.revokeShare(templateId, shareId));
    }
}
