package hr.agape.user.service;

import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.common.util.JsonUtil;
import hr.agape.user.domain.UserEntity;
import hr.agape.user.dto.UpdateUserRequestDTO;
import hr.agape.user.dto.UserDirectoryResponseDTO;
import hr.agape.user.dto.UserResponseDTO;
import hr.agape.user.mapper.UserDirectoryMapper;
import hr.agape.user.mapper.UserMapper;
import hr.agape.user.repository.UserRepository;
import hr.agape.user.util.AuthUtil;
import io.quarkus.elytron.security.common.BcryptUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

@ApplicationScoped
public class UserService {

    private final UserRepository userRepo;
    private final UserMapper userMapper;
    private final UserDirectoryMapper directoryMapper;
    private final AuthUtil authUtil;
    private final JsonUtil jsonUtil;

    @Inject
    public UserService(UserRepository userRepo, UserMapper userMapper, UserDirectoryMapper directoryMapper, AuthUtil authUtil, JsonUtil jsonUtil) {
        this.userRepo = userRepo;
        this.userMapper = userMapper;
        this.directoryMapper = directoryMapper;
        this.authUtil = authUtil;
        this.jsonUtil = jsonUtil;
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

            if (req.getDefaultWarehouseByStorageGroup() != null) {
                String json = jsonUtil.write(normalizeWarehouseDefaults(req.getDefaultWarehouseByStorageGroup()));
                user.setDefaultWarehouseByStorageGroupJson(json == null || json.isBlank() ? "{}" : json);
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

    public ServiceResponseDTO<PagedResultDTO<UserDirectoryResponseDTO>> pageUsers(int page, int size, String q) {
        try {
            Long currentUserId = authUtil.requireUserId();

            long total = userRepo.countDirectoryExcludingUser(q, currentUserId);

            List<UserDirectoryResponseDTO> items = userRepo.pageDirectoryExcludingUser(q, currentUserId, page, size)
                    .stream()
                    .map(directoryMapper::toDto)
                    .toList();

            PagedResultDTO<UserDirectoryResponseDTO> out = new PagedResultDTO<>();
            out.setItems(items);
            out.setPage(page);
            out.setSize(size);
            out.setTotal((int) total);

            return ServiceResponseDirector.successOk(out, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to get users data: " + e.getMessage());
        }
    }

    private Map<String, Long> normalizeWarehouseDefaults(Map<String, Long> raw) {
        if (raw == null || raw.isEmpty()) {
            return Map.of();
        }

        Map<String, Long> out = new LinkedHashMap<>();
        for (Map.Entry<String, Long> entry : raw.entrySet()) {
            String key = entry.getKey() == null ? "" : entry.getKey().trim();
            Long value = entry.getValue();

            if (key.isBlank()) {
                continue;
            }
            if (value == null || value <= 0) {
                continue;
            }

            out.put(key, value);
        }

        return out;
    }
}
