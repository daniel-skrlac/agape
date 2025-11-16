package hr.agape.user.service;

import hr.agape.common.response.ServiceResponse;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.user.domain.RoleEntity;
import hr.agape.user.domain.UserEntity;
import hr.agape.user.dto.AuthResponseDTO;
import hr.agape.user.dto.LoginRequestDTO;
import hr.agape.user.dto.RegisterRequestDTO;
import hr.agape.user.dto.RegisterResponseDTO;
import hr.agape.user.mapper.AuthMapper;
import hr.agape.user.repository.RoleRepository;
import hr.agape.user.repository.UserRepository;
import io.quarkus.elytron.security.common.BcryptUtil;
import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Instant;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class AuthService {

    private final UserRepository userRepo;
    private final RoleRepository roleRepo;
    private final AuthMapper authMapper;

    @ConfigProperty(name = "auth.jwt.issuer")
    String issuer;

    @ConfigProperty(name = "auth.jwt.expiration-in-seconds", defaultValue = "3600")
    long expirationSeconds;

    @ConfigProperty(name = "auth.jwt.default-role-name", defaultValue = "USER")
    String defaultRoleName;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public AuthService(UserRepository userRepo,
                       RoleRepository roleRepo,
                       AuthMapper authMapper) {
        this.userRepo = userRepo;
        this.roleRepo = roleRepo;
        this.authMapper = authMapper;
    }

    @Transactional
    public ServiceResponse<RegisterResponseDTO> register(RegisterRequestDTO req) {
        try {
            if (userRepo.existsByUsername(req.getUsername())) {
                return ServiceResponseDirector.errorBadRequest("Username already taken.");
            }

            RoleEntity defaultRole = roleRepo.findByName(defaultRoleName);
            if (defaultRole == null) {
                return ServiceResponseDirector.errorInternal(
                        "Default role '" + defaultRoleName + "' not found. Check database seed."
                );
            }

            UserEntity user = new UserEntity();
            user.setName(req.getName());
            user.setUsername(req.getUsername());
            user.setPasswordHash(BcryptUtil.bcryptHash(req.getPassword()));
            user.setRoles(Set.of(defaultRole));

            userRepo.persist(user);

            RegisterResponseDTO dto = authMapper.toRegisterResponseDto(user);

            return ServiceResponseDirector.successOk(dto, "User registered. Please log in.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal(
                    "Failed to register user: " + e.getMessage()
            );
        }
    }

    @Transactional
    public ServiceResponse<AuthResponseDTO> login(LoginRequestDTO req) {
        try {
            UserEntity user = userRepo.findByUsername(req.getUsername());
            if (user == null) {
                return ServiceResponseDirector.errorBadRequest("Invalid credentials.");
            }

            if (!BcryptUtil.matches(req.getPassword(), user.getPasswordHash())) {
                return ServiceResponseDirector.errorBadRequest("Invalid credentials.");
            }

            AuthResponseDTO dto = buildAuthResponse(user);

            return ServiceResponseDirector.successOk(dto, "Login successful.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal(
                    "Failed to login: " + e.getMessage()
            );
        }
    }

    private AuthResponseDTO buildAuthResponse(UserEntity user) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(expirationSeconds);

        Set<String> roleNames = user.getRoles() == null
                ? Set.of()
                : user.getRoles().stream()
                .map(RoleEntity::getName)
                .collect(Collectors.toSet());

        String token = Jwt.issuer(issuer)
                .subject(String.valueOf(user.getId()))
                .upn(user.getUsername())
                .groups(roleNames)
                .issuedAt(now)
                .expiresAt(exp)
                .claim("userId", user.getId())
                .claim("name", user.getName())
                .claim("roles", roleNames)
                .sign();

        return authMapper.toAuthResponseDto(user, token, expirationSeconds);
    }
}
