package hr.agape.user.dto;

import lombok.Data;

import java.util.Map;

@Data
public class AuthResponseDTO {

    private Long userId;
    private String username;
    private String name;
    private Map<String, Long> defaultWarehouseByStorageGroup = Map.of();
    private String token;
}
