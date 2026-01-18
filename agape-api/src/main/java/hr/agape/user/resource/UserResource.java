package hr.agape.user.resource;

import hr.agape.common.response.Responses;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.user.dto.UpdateUserRequestDTO;
import hr.agape.user.dto.UserResponseDTO;
import hr.agape.user.service.UserService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("api/v1/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserResource {

    private final UserService userService;

    @Inject
    public UserResource(UserService userService) {
        this.userService = userService;
    }

    @GET
    @Path("/{id}")
    public ServiceResponseDTO<UserResponseDTO> getById(@PathParam("id")
                                                       @Positive(message = "Id must be a positive number.")
                                                       Long id) {
        return userService.getById(id);
    }

    @PUT
    @Path("/{id}")
    public ServiceResponseDTO<UserResponseDTO> update(@PathParam("id")
                                                      @Positive(message = "Id must be a positive number.")
                                                      Long id, @Valid UpdateUserRequestDTO req) {
        return userService.update(id, req);
    }

    @GET
    public Response pageUsers(
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("20") int size,
            @QueryParam("q") String q
    ) {
        return Responses.from(userService.pageUsers(page, size, q));
    }
}
