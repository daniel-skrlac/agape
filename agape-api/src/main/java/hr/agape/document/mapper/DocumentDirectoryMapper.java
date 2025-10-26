package hr.agape.document.mapper;


import hr.agape.document.dto.DocumentDescriptorResponseDTO;
import hr.agape.document.lookup.view.DocumentSlotTypeView;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "cdi")
public interface DocumentDirectoryMapper {

    @Mapping(target = "documentId",     source = "documentId")
    @Mapping(target = "documentCode",   source = "documentCode")
    @Mapping(target = "displayName",    source = "displayName")
    @Mapping(target = "inOutFlag",      source = "inOutFlag")
    @Mapping(target = "changesStock",   source = "changesStock")
    DocumentDescriptorResponseDTO toResponseDto(DocumentSlotTypeView view);
}
