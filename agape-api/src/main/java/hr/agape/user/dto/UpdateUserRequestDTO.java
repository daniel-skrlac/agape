package hr.agape.user.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class UpdateUserRequestDTO {
    private String username;
    private String name;
    private String password;

    private Map<String, Long> defaultWarehouseByStorageGroup;
}
