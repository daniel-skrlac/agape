package hr.agape.template.mapper;

import hr.agape.template.domain.DispatchTemplateDocEntity;
import hr.agape.template.domain.DispatchTemplateDocItemEntity;
import hr.agape.template.domain.DispatchTemplateEntity;
import hr.agape.template.dto.TemplateDocResponseDTO;
import hr.agape.template.dto.TemplateItemResponseDTO;
import hr.agape.template.dto.TemplateResponseDTO;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "cdi")
public interface DispatchTemplateMapper {

    @Mapping(target = "folderId", source = "folder.id")
    @Mapping(target = "householdSize", expression = "java(entity.getHouseholdSize() == null ? null : entity.getHouseholdSize().intValue())")
    @Mapping(target = "shared", ignore = true)
    @Mapping(target = "sharedPermission", ignore = true)
    TemplateResponseDTO toDto(DispatchTemplateEntity entity);

    TemplateDocResponseDTO toDocDto(DispatchTemplateDocEntity entity);

    @Mapping(target = "itemName", ignore = true)
    @Mapping(target = "itemCode", ignore = true)
    @Mapping(target = "unit", ignore = true)
    @Mapping(target = "barcode", ignore = true)
    TemplateItemResponseDTO toItemDto(DispatchTemplateDocItemEntity entity);
}
