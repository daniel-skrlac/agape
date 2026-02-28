package hr.agape.template.mapper;

import hr.agape.common.util.JsonUtil;
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
    JsonUtil jsonUtil;

    @Mapping(target = "entries", ignore = true)
    @Mapping(target = "finalResult", expression = "java(parseJson(entity.getFinalResultJson()))")
    public abstract BookingSessionResponseDTO toDto(DispatchBookingSessionEntity entity);

    @Mapping(target = "docPatches", expression = "java(parseJson(entry.getDocPatchesJson()))")
    @Mapping(target = "extraItems", expression = "java(parseJson(entry.getExtraItemsJson()))")
    @Mapping(target = "partnerName", ignore = true)
    public abstract BookingSessionEntryResponseDTO toDto(DispatchBookingSessionEntryEntity entry);

    @SuppressWarnings("unused")
    protected Object parseJson(String json) {
        return jsonUtil.readObjectOrNull(json);
    }
}
