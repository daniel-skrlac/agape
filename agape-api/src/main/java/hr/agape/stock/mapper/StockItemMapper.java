package hr.agape.stock.mapper;

import hr.agape.stock.domain.StockItemStatus;
import hr.agape.stock.dto.StockItemSummaryDTO;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "cdi")
public interface StockItemMapper {

    @Mapping(target = "itemId",        source = "itemId")
    @Mapping(target = "warehouseId",   source = "warehouseId")
    @Mapping(target = "itemCode",      source = "itemCode")
    @Mapping(target = "name",          source = "name")
    @Mapping(target = "unit",          source = "unit")
    @Mapping(target = "currentQty",    source = "currentQty")
    @Mapping(target = "minimalQty",    source = "minimalQty")
    @Mapping(target = "recommendedQty", source = "recommendedQty")
    @Mapping(target = "reservedQty",   source = "reservedQty")
    StockItemSummaryDTO toDto(StockItemStatus src);
}
