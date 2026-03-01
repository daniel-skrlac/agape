package hr.agape.user.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserDirectoryResponseDTO {
    private Long id;
    private String username;
    private String name;
}