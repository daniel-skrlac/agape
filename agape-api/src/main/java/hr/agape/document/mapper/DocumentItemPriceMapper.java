package hr.agape.document.mapper;

import hr.agape.document.domain.DocumentItemPriceEntity;
import hr.agape.document.dto.DocumentItemPriceDTO;
import org.mapstruct.Mapper;

@Mapper(componentModel = "cdi")
public interface DocumentItemPriceMapper {

    DocumentItemPriceEntity toEntity(DocumentItemPriceDTO dto);

    DocumentItemPriceDTO toDto(DocumentItemPriceEntity entity);
}
