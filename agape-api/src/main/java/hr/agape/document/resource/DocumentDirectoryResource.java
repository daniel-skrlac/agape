package hr.agape.document.resource;

import hr.agape.common.response.Responses;
import hr.agape.document.service.DocumentDirectoryService;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/document-directory")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DocumentDirectoryResource {

    private final DocumentDirectoryService service;

    @Inject
    public DocumentDirectoryResource(DocumentDirectoryService service) {
        this.service = service;
    }

    @GET
    @Path("/doc-types/{documentId}")
    public Response getDocumentDescriptor(
            @PathParam("documentId") int documentId
    ) {
        return Responses.from(service.getDocumentDescriptor(documentId));
    }

    @GET
    @Path("/doc-types")
    public Response pageDocumentTypes(
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("10") int size
    ) {
        return Responses.from(service.pageDocumentDescriptors(page, size));
    }

    @GET
    @Path("/doc-types/{documentId}/warehouses")
    public Response pageWarehousesForDocument(
            @PathParam("documentId") int documentId,
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("10") int size
    ) {
        return Responses.from(service.pageWarehousesForDocument(documentId, page, size));
    }
}
