package hr.agape.user.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateUserRequestDTO {
    private String username;
    private String name;
    private String password;
}
