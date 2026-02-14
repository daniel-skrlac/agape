package hr.agape.item.resource;

import hr.agape.common.constant.Roles;
import hr.agape.common.response.Responses;
import hr.agape.item.service.ItemDirectoryService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/item-directory")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed(Roles.USER)
public class ItemDirectoryResource {

    private final ItemDirectoryService service;

    @Inject
    public ItemDirectoryResource(ItemDirectoryService service) {
        this.service = service;
    }

    @GET
    @Path("/items")
    public Response pageItems(
            @QueryParam("warehouseId") Long warehouseId,
            @QueryParam("q") String q,
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("20") int size
    ) {
        return Responses.from(service.pageItems(warehouseId, page, size, q));
    }
}
