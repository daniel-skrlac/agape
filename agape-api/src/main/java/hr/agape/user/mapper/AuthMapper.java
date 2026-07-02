package hr.agape.user.mapper;

import hr.agape.common.util.JsonUtil;
import hr.agape.user.domain.UserEntity;
import hr.agape.user.dto.AuthResponseDTO;
import hr.agape.user.dto.RegisterResponseDTO;
import jakarta.inject.Inject;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.LinkedHashMap;
import java.util.Map;

@Mapper(componentModel = "cdi")
public abstract class AuthMapper {

    @Inject
    JsonUtil jsonUtil;

    @Mapping(target = "userId", source = "user.id")
    @Mapping(target = "username", source = "user.username")
    @Mapping(target = "name", source = "user.name")
    @Mapping(target = "defaultWarehouseByStorageGroup", expression = "java(parseWarehouseDefaults(user.getDefaultWarehouseByStorageGroupJson()))")
    @Mapping(target = "token", source = "token")
    public abstract AuthResponseDTO toAuthResponseDto(UserEntity user, String token);

    @Mapping(target = "userId", source = "id")
    @Mapping(target = "username", source = "username")
    @Mapping(target = "name", source = "name")
    public abstract RegisterResponseDTO toRegisterResponseDto(UserEntity user);

    protected Map<String, Long> parseWarehouseDefaults(String json) {
        Object raw = jsonUtil.readObjectOrNull(json);
        if (!(raw instanceof Map<?, ?> map)) {
            return Map.of();
        }

        Map<String, Long> out = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            String key = String.valueOf(entry.getKey()).trim();
            if (key.isBlank()) {
                continue;
            }

            Long value = toLong(entry.getValue());
            if (value != null && value > 0) {
                out.put(key, value);
            }
        }

        return out;
    }

    private Long toLong(Object value) {
        if (value == null) return null;
        try {
            if (value instanceof Number number) return number.longValue();
            String raw = String.valueOf(value).trim();
            if (raw.isBlank()) return null;
            return Long.valueOf(raw);
        } catch (Exception ignored) {
            return null;
        }
    }
}
