package hr.agape.user.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class UserResponseDTO {
    private Long id;
    private String username;
    private String name;
    private Map<String, Long> defaultWarehouseByStorageGroup = Map.of();
}
