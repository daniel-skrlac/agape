package hr.agape.document.user.domain;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserEntity {
    private Long userId;
    private String oib;
    private Integer vatSystem;
}
