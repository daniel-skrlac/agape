package hr.agape.dispatch.mapper;

import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.dto.DispatchResponseDTO;
import hr.agape.document.domain.DocumentHeader;
import hr.agape.document.domain.DocumentLine;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "cdi")
public interface DispatchApiMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(source = "documentId", target = "documentId")
    @Mapping(source = "documentDate", target = "documentDate")
    @Mapping(source = "partnerId", target = "partnerId")
    @Mapping(source = "createdBy",     target = "createdBy")
    @Mapping(target = "documentNumber", ignore = true)
    DocumentHeader toHeader(DispatchRequestDTO req);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "headerId", ignore = true)
    @Mapping(source = "itemId", target = "itemId")
    @Mapping(source = "quantity", target = "quantity")
    @Mapping(target = "lineNumber", ignore = true)
    @Mapping(target = "nameId", ignore = true)
    @Mapping(target = "vatId", ignore = true)
    @Mapping(target = "uomId", ignore = true)
    DocumentLine toLine(DispatchRequestDTO.DispatchItemRequest r);

    List<DocumentLine> toLines(List<DispatchRequestDTO.DispatchItemRequest> list);

    @Mapping(source = "id", target = "documentHeaderId")
    @Mapping(source = "documentId", target = "documentId")
    @Mapping(source = "documentNumber", target = "documentBr")
    @Mapping(source = "documentDate", target = "documentDate")
    @Mapping(source = "partnerId", target = "partnerId")
        //@Mapping(target = "status", constant = "BOOKED")
    DispatchResponseDTO toResponse(DocumentHeader header);
}
