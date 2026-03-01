package hr.agape.document.resource;

import hr.agape.common.constant.Roles;
import hr.agape.common.response.Responses;
import hr.agape.document.service.DocumentDirectoryService;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.RolesAllowed;
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
@RolesAllowed(Roles.USER)
public class DocumentDirectoryResource {

    private final DocumentDirectoryService service;

    @Inject
    public DocumentDirectoryResource(DocumentDirectoryService service) {
        this.service = service;
    }

    @GET
    @Path("/doc-types/{documentId}")
    public Response getDocumentDescriptor(
            @PathParam("documentId") Long documentId
    ) {
        return Responses.from(service.getDocumentDescriptor(documentId));
    }

    @GET
    @Path("/doc-types")
    public Response listDocumentDescriptors(
            @QueryParam("warehouseId") Long warehouseId,
            @QueryParam("documentCode") String documentCode,
            @QueryParam("q") String q,
            @QueryParam("excludeCodes") String excludeCodes,
            @QueryParam("excludeDocumentIds") String excludeDocumentIds
    ) {
        return Responses.from(service.listDocumentDescriptors(warehouseId, documentCode, q, excludeCodes, excludeDocumentIds));
    }


    @GET
    @Path("/doc-types/{documentId}/warehouses")
    public Response listWarehousesForDocument(@PathParam("documentId") int documentId) {
        return Responses.from(service.listWarehousesForDocument(documentId));
    }
}
