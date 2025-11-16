package hr.agape.user.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterResponseDTO {
    private Long userId;
    private String username;
    private String name;
}
