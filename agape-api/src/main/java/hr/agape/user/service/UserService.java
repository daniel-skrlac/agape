package hr.agape.user.service;

import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.user.domain.UserEntity;
import hr.agape.user.dto.UpdateUserRequestDTO;
import hr.agape.user.dto.UserResponseDTO;
import hr.agape.user.mapper.UserMapper;
import hr.agape.user.repository.UserRepository;
import io.quarkus.elytron.security.common.BcryptUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class UserService {

    private final UserRepository userRepo;
    private final UserMapper userMapper;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public UserService(UserRepository userRepo, UserMapper userMapper) {
        this.userRepo = userRepo;
        this.userMapper = userMapper;
    }

    public ServiceResponseDTO<UserResponseDTO> getById(Long userId) {
        try {
            if (userId == null) {
                return ServiceResponseDirector.errorBadRequest("User id is required.");
            }

            UserEntity user = userRepo.findById(userId);
            if (user == null) {
                return ServiceResponseDirector.errorNotFound("User not found.");
            }

            UserResponseDTO dto = userMapper.toUserResponseDto(user);
            return ServiceResponseDirector.successOk(dto, "User fetched.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to fetch user: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponseDTO<UserResponseDTO> update(Long userId, UpdateUserRequestDTO req) {
        try {
            if (req == null) {
                return ServiceResponseDirector.errorBadRequest("Request body is required.");
            }

            UserEntity user = userRepo.findById(userId);
            if (user == null) {
                return ServiceResponseDirector.errorNotFound("User not found.");
            }

            boolean changed = false;

            if (req.getName() != null) {
                String newName = req.getName().trim();
                if (newName.isEmpty()) {
                    return ServiceResponseDirector.errorBadRequest("Name cannot be empty.");
                }
                user.setName(newName);
                changed = true;
            }

            if (req.getUsername() != null) {
                String newUsername = req.getUsername().trim();
                if (newUsername.isEmpty()) {
                    return ServiceResponseDirector.errorBadRequest("Username cannot be empty.");
                }

                String currentUsername = user.getUsername() == null ? "" : user.getUsername();
                if (!currentUsername.equalsIgnoreCase(newUsername)) {
                    if (userRepo.existsByUsernameExcludingId(newUsername, userId)) {
                        return ServiceResponseDirector.errorBadRequest("Username already taken.");
                    }
                    user.setUsername(newUsername);
                    changed = true;
                }
            }

            if (req.getPassword() != null) {
                String pw = req.getPassword();
                if (pw.trim().isEmpty()) {
                    return ServiceResponseDirector.errorBadRequest("Password cannot be empty.");
                }
                user.setPasswordHash(BcryptUtil.bcryptHash(pw));
                changed = true;
            }

            if (!changed) {
                UserResponseDTO dto = userMapper.toUserResponseDto(user);
                return ServiceResponseDirector.successOk(dto, "No changes applied.");
            }

            UserResponseDTO dto = userMapper.toUserResponseDto(user);
            return ServiceResponseDirector.successOk(dto, "User updated.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to update user: " + e.getMessage());
        }
    }
}
