package hr.agape.document.mapper;


import hr.agape.document.dto.DocumentDescriptorResponseDTO;
import hr.agape.document.lookup.view.DocumentSlotTypeView;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "cdi")
public interface DocumentDirectoryMapper {

    @Mapping(target = "documentId",     source = "documentId")
    @Mapping(target = "warehouseId",    source = "warehouseId")
    @Mapping(target = "storageGroupId", source = "storageGroupId")
    @Mapping(target = "storageGroupName", source = "storageGroupName")
    @Mapping(target = "documentCode",   source = "documentCode")
    @Mapping(target = "displayName",    source = "displayName")
    @Mapping(target = "inOutFlag",      source = "inOutFlag")
    @Mapping(target = "changesStock",   source = "changesStock")
    @Mapping(target = "scanSupported", expression = "java(hr.agape.document.util.DocumentScanSupport.isSupportedForDispatchSlipScan(view))")
    DocumentDescriptorResponseDTO toResponseDto(DocumentSlotTypeView view);
}
