package hr.agape.user.dto;

import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateUserRequestDTO {
    private String username;
    private String name;
    private String password;

    @Positive
    private Long defaultWarehouseId;
}
