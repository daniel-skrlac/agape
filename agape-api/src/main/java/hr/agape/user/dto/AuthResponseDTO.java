package hr.agape.user.dto;

import lombok.Data;

@Data
public class AuthResponseDTO {

    private Long userId;
    private String username;
    private String name;
    private Long defaultWarehouseId;
    private String token;
}
