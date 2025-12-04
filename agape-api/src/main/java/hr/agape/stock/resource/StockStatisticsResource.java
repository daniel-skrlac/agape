package hr.agape.stock.resource;

import hr.agape.common.constant.Roles;
import hr.agape.common.response.Responses;
import hr.agape.stock.service.StockStatisticsService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/stock-statistics")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RequestScoped
@RolesAllowed(Roles.USER)
public class StockStatisticsResource {

    private final StockStatisticsService service;

    @Inject
    public StockStatisticsResource(StockStatisticsService service) {
        this.service = service;
    }

    @GET
    public Response getStatistics() {
        return Responses.from(service.getStatistics());
    }
}
