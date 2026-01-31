package hr.agape.item.mapper;

import hr.agape.item.domain.ItemDirectoryView;
import hr.agape.item.dto.ItemDescriptorResponseDTO;
import org.mapstruct.Mapper;

@Mapper(componentModel = "cdi")
public interface ItemDirectoryMapper {
    ItemDescriptorResponseDTO toDto(ItemDirectoryView v);
}
