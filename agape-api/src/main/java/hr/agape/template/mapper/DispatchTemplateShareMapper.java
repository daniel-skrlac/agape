package hr.agape.template.mapper;

import hr.agape.template.domain.DispatchTemplateEntity;
import hr.agape.template.domain.DispatchTemplateShareEntity;
import hr.agape.template.dto.TemplateShareCreateRequestDTO;
import hr.agape.template.dto.TemplateShareResponseDTO;
import hr.agape.template.enumeration.DispatchTemplateSharePermission;
import hr.agape.user.domain.UserEntity;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "cdi")
public interface DispatchTemplateShareMapper {

    @Mapping(target = "templateId", source = "template.id")
    @Mapping(target = "sharedWithUserId", source = "sharedWith.id")
    @Mapping(target = "sharedWithUsername", source = "sharedWith.username")
    TemplateShareResponseDTO toDto(DispatchTemplateShareEntity entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "template", source = "template")
    @Mapping(target = "sharedWith", source = "sharedWith")
    @Mapping(target = "permission", source = "req.permission")
    @Mapping(target = "createdAt", ignore = true)
    DispatchTemplateShareEntity toEntity(
            TemplateShareCreateRequestDTO req,
            DispatchTemplateEntity template,
            UserEntity sharedWith
    );

    @AfterMapping
    default void fillDefaults(@MappingTarget DispatchTemplateShareEntity entity) {
        if (entity.getPermission() == null) {
            entity.setPermission(DispatchTemplateSharePermission.BOOK);
        }
    }
}
