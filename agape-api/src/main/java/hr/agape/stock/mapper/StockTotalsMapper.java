package hr.agape.stock.mapper;

import hr.agape.stock.dto.StockStatisticsTotalsDTO;
import org.mapstruct.Mapper;

@Mapper(componentModel = "cdi")
public interface StockTotalsMapper {

    StockStatisticsTotalsDTO toDto(StockStatisticsTotalsDTO src);
}
