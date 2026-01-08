package hr.agape.template.mapper;

import hr.agape.template.domain.DispatchTemplateFolderEntity;
import hr.agape.template.dto.FolderResponseDTO;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "cdi")
public interface DispatchTemplateFolderMapper {

    @Mapping(target = "parentId", source = "parent.id")
    FolderResponseDTO toDto(DispatchTemplateFolderEntity entity);
}
