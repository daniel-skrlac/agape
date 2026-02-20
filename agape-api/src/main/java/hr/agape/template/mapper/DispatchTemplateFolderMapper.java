package hr.agape.template.mapper;

import hr.agape.template.domain.DispatchTemplateFolderEntity;
import hr.agape.template.dto.FolderCreateRequestDTO;
import hr.agape.template.dto.FolderResponseDTO;
import hr.agape.user.domain.UserEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "cdi")
public interface DispatchTemplateFolderMapper {

    @Mapping(target = "parentId", source = "parent.id")
    FolderResponseDTO toDto(DispatchTemplateFolderEntity entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "owner", source = "owner")
    @Mapping(target = "parent", source = "parent")
    @Mapping(target = "name", source = "req.name")
    @Mapping(target = "children", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    DispatchTemplateFolderEntity toEntity(
            FolderCreateRequestDTO req,
            UserEntity owner,
            DispatchTemplateFolderEntity parent
    );
}
