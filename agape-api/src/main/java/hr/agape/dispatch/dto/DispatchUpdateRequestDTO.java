package hr.agape.dispatch.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchUpdateRequestDTO {

    /**
     * Filled from JWT on the backend, FRONTEND MUST NOT SEND IT.
     */
    @JsonIgnore
    private Long actorUserId;

    private boolean cancel;

    private String cancelReason;

    private Long partnerId;

    private String overrideNote;

    @Valid
    @Size(min = 1, message = "items must contain at least one line when provided")
    private List<DispatchItemPatch> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DispatchItemPatch {

        @NotNull
        private Long itemId;

        @NotNull
        @DecimalMin(
                value = "0.0",
                inclusive = false,
                message = "quantity must be > 0"
        )
        private Double quantity;
    }
}
