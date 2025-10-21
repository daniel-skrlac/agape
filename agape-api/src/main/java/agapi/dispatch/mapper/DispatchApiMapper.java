package agapi.dispatch.mapper;

import agapi.dispatch.dto.DispatchNoteRequestDTO;
import agapi.dispatch.dto.DispatchNoteResponseDTO;
import agapi.document.domain.DocumentHeader;
import agapi.document.domain.DocumentLine;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "cdi")
public interface DispatchApiMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(source = "documentId", target = "documentId")
    @Mapping(source = "documentDate", target = "documentDate")
    @Mapping(source = "partnerId", target = "partnerId")
    @Mapping(source = "dispatchNumber", target = "dispatchNumber")
    @Mapping(target = "documentNumber", ignore = true)
    DocumentHeader toHeader(DispatchNoteRequestDTO req);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "headerId", ignore = true)
    @Mapping(source = "itemId", target = "itemId")
    @Mapping(source = "quantity", target = "quantity")
    @Mapping(target = "lineNumber", ignore = true)
    @Mapping(target = "nameId", ignore = true)
    @Mapping(target = "vatId", ignore = true)
    @Mapping(target = "uomId", ignore = true)
    DocumentLine toLine(DispatchNoteRequestDTO.DispatchItemRequest r);

    List<DocumentLine> toLines(List<DispatchNoteRequestDTO.DispatchItemRequest> list);

    @Mapping(source = "id", target = "headerId")
    @Mapping(source = "documentId", target = "documentId")
    @Mapping(source = "documentNumber", target = "documentNumber")
    @Mapping(source = "documentDate", target = "documentDate")
    @Mapping(source = "partnerId", target = "partnerId")
    @Mapping(target = "status", constant = "BOOKED")
    DispatchNoteResponseDTO toResponse(DocumentHeader header);
}
