package hr.agape.partner.rest.v1;

import hr.agape.common.response.Responses;
import hr.agape.partner.dto.PartnerCreateRequest;
import hr.agape.partner.dto.PartnerSearchFilter;
import hr.agape.partner.dto.PartnerUpdateRequest;
import hr.agape.partner.service.PartnerService;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.BeanParam;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/partners")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RequestScoped
public class PartnerResource {

    private final PartnerService service;

    @Inject
    public PartnerResource(PartnerService service) {
        this.service = service;
    }

    @GET
    public Response search(@BeanParam @Valid PartnerSearchFilter filter) {
        return Responses.from(service.search(filter));
    }

    @GET
    @Path("{id}")
    public Response getOne(@PathParam("id") Long id) {
        return Responses.from(service.getOne(id));
    }

    @POST
    public Response create(@Valid PartnerCreateRequest body) {
        return Responses.from(service.create(body));
    }

    @PUT
    @Path("{id}")
    public Response update(@PathParam("id") Long id, @Valid PartnerUpdateRequest body) {
        return Responses.from(service.update(id, body));
    }
}
