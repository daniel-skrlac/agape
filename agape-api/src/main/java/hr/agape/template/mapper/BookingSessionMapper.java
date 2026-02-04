package hr.agape.template.mapper;

import com.fasterxml.jackson.databind.ObjectMapper;
import hr.agape.template.domain.DispatchBookingSessionEntity;
import hr.agape.template.domain.DispatchBookingSessionEntryEntity;
import hr.agape.template.dto.BookingSessionEntryResponseDTO;
import hr.agape.template.dto.BookingSessionResponseDTO;
import jakarta.inject.Inject;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "cdi")
public abstract class BookingSessionMapper {

    @Inject
    ObjectMapper om;

    @Mapping(target = "entries", ignore = true)
    @Mapping(target = "finalResult", expression = "java(parse(entity.getFinalResultJson()))")
    public abstract BookingSessionResponseDTO toDto(DispatchBookingSessionEntity entity);

    @Mapping(target = "docPatches", expression = "java(parse(entry.getDocPatchesJson()))")
    @Mapping(target = "extraItems", expression = "java(parse(entry.getExtraItemsJson()))")
    public abstract BookingSessionEntryResponseDTO toDto(DispatchBookingSessionEntryEntity entry);

    protected Object parse(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return om.readValue(json, Object.class);
        } catch (Exception e) {
            return null;
        }
    }

    public String toJson(Object obj) {
        if (obj == null) return "[]";
        try {
            return om.writeValueAsString(obj);
        } catch (Exception e) {
            return "[]";
        }
    }
}
