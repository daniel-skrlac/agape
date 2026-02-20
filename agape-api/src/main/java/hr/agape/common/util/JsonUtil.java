package hr.agape.common.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.List;

@ApplicationScoped
public class JsonUtil {

    private final ObjectMapper objectMapper;

    @Inject
    public JsonUtil(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public <T> List<T> readList(String json, TypeReference<List<T>> type) {
        if (json == null || json.isBlank()) {
            return List.of();
        }

        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            return List.of();
        }
    }

    public Object readObjectOrNull(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }

        try {
            return objectMapper.readValue(json, Object.class);
        } catch (Exception e) {
            return null;
        }
    }

    public String write(Object value) {
        if (value == null) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return null;
        }
    }
}