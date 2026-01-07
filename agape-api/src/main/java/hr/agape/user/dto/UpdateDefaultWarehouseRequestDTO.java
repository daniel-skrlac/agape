package hr.agape.user.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateDefaultWarehouseRequestDTO {

    @NotNull
    @Positive
    private Long warehouseId;
}

