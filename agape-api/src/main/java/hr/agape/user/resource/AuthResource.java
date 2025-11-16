package hr.agape.user.resource;

import hr.agape.common.response.ServiceResponse;
import hr.agape.user.dto.AuthResponseDTO;
import hr.agape.user.dto.LoginRequestDTO;
import hr.agape.user.dto.RegisterRequestDTO;
import hr.agape.user.dto.RegisterResponseDTO;
import hr.agape.user.service.AuthService;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/auth")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@PermitAll
public class AuthResource {

    private final AuthService authService;

    @Inject
    public AuthResource(AuthService authService) {
        this.authService = authService;
    }

    @POST
    @Path("/register")
    public ServiceResponse<RegisterResponseDTO> register(@Valid RegisterRequestDTO request) {
        return authService.register(request);
    }

    @POST
    @Path("/login")
    public ServiceResponse<AuthResponseDTO> login(@Valid LoginRequestDTO request) {
        return authService.login(request);
    }
}
