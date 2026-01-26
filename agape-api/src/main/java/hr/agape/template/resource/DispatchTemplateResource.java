package hr.agape.template.resource;

import hr.agape.common.constant.Roles;
import hr.agape.common.response.Responses;
import hr.agape.template.dto.TemplateCreateRequestDTO;
import hr.agape.template.dto.TemplateDocUpsertRequestDTO;
import hr.agape.template.dto.TemplateItemUpsertRequestDTO;
import hr.agape.template.dto.TemplateUpdateRequestDTO;
import hr.agape.template.service.DispatchTemplateService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;

@Path("/api/v1/dispatch-templates")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RequestScoped
@RolesAllowed(Roles.USER)
public class DispatchTemplateResource {

    private final DispatchTemplateService service;

    @Inject
    public DispatchTemplateResource(DispatchTemplateService service) {
        this.service = service;
    }

    @GET
    public Response listTemplates(
            @QueryParam("folderId") Long folderId,
            @QueryParam("name") String q,
            @QueryParam("includeShared") @DefaultValue("true") boolean includeShared,
            @QueryParam("rootOnly") @DefaultValue("false") boolean rootOnly
    ) {
        return Responses.from(service.listTemplateHeaders(folderId, q, includeShared, rootOnly));
    }

    @POST
    public Response createTemplate(@Valid TemplateCreateRequestDTO req) {
        return Responses.from(service.createTemplate(req));
    }

    @GET
    @Path("/{id}")
    public Response getTemplate(@PathParam("id") Long id) {
        return Responses.from(service.getTemplate(id));
    }

    @PUT
    @Path("/{id}")
    public Response updateTemplate(@PathParam("id") Long id, @Valid TemplateUpdateRequestDTO req) {
        return Responses.from(service.updateTemplate(id, req));
    }

    @DELETE
    @Path("/{id}")
    public Response deleteTemplate(@PathParam("id") Long id) {
        return Responses.from(service.deleteTemplate(id));
    }

    @POST
    @Path("/{id}/documents")
    public Response upsertTemplateDoc(
            @PathParam("id") Long templateId,
            @Valid TemplateDocUpsertRequestDTO req
    ) {
        return Responses.from(service.upsertTemplateDoc(templateId, req));
    }

    @PUT
    @Path("/{id}/documents/{templateDocId}/items")
    public Response replaceDocItems(
            @PathParam("id") Long templateId,
            @PathParam("templateDocId") Long templateDocId,
            @Valid List<TemplateItemUpsertRequestDTO> items
    ) {
        return Responses.from(service.replaceTemplateDocItems(templateId, templateDocId, items));
    }
}
