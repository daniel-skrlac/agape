package hr.agape.template.resource;

import hr.agape.common.constant.Roles;
import hr.agape.common.dto.BaseSearchFilter;
import hr.agape.common.response.Responses;
import hr.agape.template.dto.FolderCopyRequestDTO;
import hr.agape.template.dto.FolderCreateRequestDTO;
import hr.agape.template.dto.FolderMoveRequestDTO;
import hr.agape.template.dto.FolderRenameRequestDTO;
import hr.agape.template.service.DispatchTemplateFolderService;
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
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/dispatch-template-folders")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RequestScoped
@RolesAllowed(Roles.USER)
public class DispatchTemplateFolderResource {

    private final DispatchTemplateFolderService service;

    @Inject
    public DispatchTemplateFolderResource(DispatchTemplateFolderService service) {
        this.service = service;
    }

    @GET
    public Response listFolders(
            @QueryParam("parentId") Long parentId,
            @BeanParam @Valid BaseSearchFilter paging
    ) {
        return Responses.from(service.listFolders(parentId, paging));
    }

    @GET
    @Path("/tree")
    public Response listFolderTree() {
        return Responses.from(service.listFolderTree());
    }

    @POST
    public Response createFolder(@Valid FolderCreateRequestDTO req) {
        return Responses.from(service.createFolder(req));
    }

    @PUT
    @Path("/{id}")
    public Response renameFolder(@PathParam("id") Long id, @Valid FolderRenameRequestDTO req) {
        return Responses.from(service.renameFolder(id, req));
    }

    @PUT
    @Path("/{id}/move")
    public Response moveFolder(@PathParam("id") Long id, @Valid FolderMoveRequestDTO req) {
        return Responses.from(service.moveFolder(id, req));
    }

    @POST
    @Path("/{id}/copy")
    public Response copyFolder(@PathParam("id") Long id, @Valid FolderCopyRequestDTO req) {
        return Responses.from(service.copyFolderTree(id, req));
    }

    @DELETE
    @Path("/{id}")
    public Response deleteFolder(@PathParam("id") Long id) {
        return Responses.from(service.deleteFolder(id));
    }
}
