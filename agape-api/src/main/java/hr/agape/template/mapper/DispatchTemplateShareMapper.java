package hr.agape.template.mapper;

import hr.agape.template.domain.DispatchTemplateShareEntity;
import hr.agape.template.dto.TemplateShareResponseDTO;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "cdi")
public interface DispatchTemplateShareMapper {

    @Mapping(target = "templateId", source = "template.id")
    @Mapping(target = "sharedWithUserId", source = "sharedWith.id")
    @Mapping(target = "sharedWithUsername", source = "sharedWith.username")
    TemplateShareResponseDTO toDto(DispatchTemplateShareEntity entity);
}
