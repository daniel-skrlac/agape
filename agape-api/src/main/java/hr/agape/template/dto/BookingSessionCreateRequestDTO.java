package hr.agape.template.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class BookingSessionCreateRequestDTO {

    @NotBlank
    private String title;

    private String note;

    @NotNull
    private Long warehouseId;

    private LocalDate documentDate;
}
