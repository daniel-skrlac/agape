package hr.agape.user.mapper;

import hr.agape.common.util.JsonUtil;
import hr.agape.user.domain.UserEntity;
import hr.agape.user.dto.UserResponseDTO;
import jakarta.inject.Inject;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.LinkedHashMap;
import java.util.Map;

@Mapper(componentModel = "cdi")
public abstract class UserMapper {

    @Inject
    JsonUtil jsonUtil;

    @Mapping(target = "defaultWarehouseByStorageGroup", expression = "java(parseWarehouseDefaults(user.getDefaultWarehouseByStorageGroupJson()))")
    public abstract UserResponseDTO toUserResponseDto(UserEntity user);

    @SuppressWarnings("unchecked")
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
