package hr.agape.dispatch.mapper;

import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.dto.DispatchResponseDTO;
import hr.agape.dispatch.dto.DispatchSummaryResponseDTO;
import hr.agape.document.domain.DocumentHeaderEntity;
import hr.agape.document.domain.DocumentLineEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

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
    @Mapping(target = "postedBy", ignore = true)
    @Mapping(target = "postedAt", ignore = true)
    @Mapping(target = "posted", ignore = true)
    @Mapping(target = "cancelledBy", ignore = true)
    @Mapping(target = "cancelledAt", ignore = true)
    @Mapping(target = "cancelNote", ignore = true)
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

    @Mapping(
            target = "status",
            source = "entity",
            qualifiedByName = "statusFromEntity"
    )
    @Mapping(
            target = "cancelled",
            source = "cancelledBy",
            qualifiedByName = "isCancelled"
    )
    DispatchSummaryResponseDTO toDto(DocumentHeaderEntity entity);

    @Mapping(source = "id", target = "documentHeaderId")
    @Mapping(source = "documentId", target = "documentId")
    @Mapping(source = "documentNumber", target = "documentBr")
    @Mapping(source = "documentDate", target = "documentDate")
    @Mapping(source = "partnerId", target = "partnerId")
    @Mapping(source = "createdAt", target = "createdAt")
    @Mapping(source = "posted", target = "posted")
    @Mapping(source = "postedBy", target = "postedBy")
    @Mapping(source = "postedAt", target = "postedAt")
    @Mapping(
            target = "cancelled",
            source = "cancelledBy",
            qualifiedByName = "isCancelled"
    )
    @Mapping(source = "cancelledBy", target = "cancelledBy")
    @Mapping(source = "cancelledAt", target = "cancelledAt")
    @Mapping(source = "cancelNote", target = "cancelNote")
    @Mapping(
            target = "status",
            source = "header",
            qualifiedByName = "statusFromEntity"
    )
    DispatchResponseDTO toResponse(DocumentHeaderEntity header);

    @Named("isCancelled")
    static Boolean isCancelled(Long cancelledBy) {
        return cancelledBy != null;
    }

    @Named("statusFromEntity")
    static String statusFromEntity(DocumentHeaderEntity e) {
        if (e.getCancelledBy() != null) {
            return "CANCELLED";
        }
        if (Boolean.TRUE.equals(e.getPosted())) {
            return "POSTED";
        }
        return "DRAFT";
    }
}
