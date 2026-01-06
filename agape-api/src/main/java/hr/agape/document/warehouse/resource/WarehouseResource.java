package hr.agape.document.warehouse.resource;

import hr.agape.common.constant.Roles;
import hr.agape.common.response.Responses;
import hr.agape.document.warehouse.service.WarehouseService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/warehouses")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RequestScoped
@RolesAllowed(Roles.USER)
public class WarehouseResource {

    private final WarehouseService service;

    @Inject
    public WarehouseResource(WarehouseService service) {
        this.service = service;
    }

    @GET
    public Response getWarehouses() {
        return Responses.from(service.getWarehouses());
    }
}
