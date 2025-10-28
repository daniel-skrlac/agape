package hr.agape.dispatch.mapper;

import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.dto.DispatchResponseDTO;
import hr.agape.dispatch.dto.DispatchSummaryResponseDTO;
import hr.agape.document.domain.DocumentHeaderEntity;
import hr.agape.document.domain.DocumentLineEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "cdi")
public interface DispatchApiMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(source = "documentId", target = "documentId")
    @Mapping(source = "documentDate", target = "documentDate")
    @Mapping(source = "partnerId", target = "partnerId")
    @Mapping(source = "createdBy", target = "createdBy")
    @Mapping(target = "documentNumber", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    DocumentHeaderEntity toHeader(DispatchRequestDTO req);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "headerId", ignore = true)
    @Mapping(source = "itemId", target = "itemId")
    @Mapping(source = "quantity", target = "quantity")
    @Mapping(target = "lineNumber", ignore = true)
    @Mapping(target = "nameId", ignore = true)
    @Mapping(target = "vatId", ignore = true)
    @Mapping(target = "uomId", ignore = true)
    DocumentLineEntity toLine(DispatchRequestDTO.DispatchItemRequest r);

    List<DocumentLineEntity> toLines(List<DispatchRequestDTO.DispatchItemRequest> list);

    DispatchSummaryResponseDTO toDto(DocumentHeaderEntity entity);

    @Mapping(source = "id", target = "documentHeaderId")
    @Mapping(source = "documentId", target = "documentId")
    @Mapping(source = "documentNumber", target = "documentBr")
    @Mapping(source = "documentDate", target = "documentDate")
    @Mapping(source = "partnerId", target = "partnerId")
    @Mapping(source = "createdAt", target = "createdAt")
        //@Mapping(target = "status", constant = "BOOKED")
    DispatchResponseDTO toResponse(DocumentHeaderEntity header);
}
