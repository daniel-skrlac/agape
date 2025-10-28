package hr.agape.dispatch.dto;

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

    // who is performing the update (required)
    private Long actorUserId;

    // 1) CANCEL A POSTED DOC
    // if true -> we cancel this dispatch (storno)
    private boolean cancel;

    // optional cancellation note, goes to SD_GLAVA.NAPOMENA
    private String cancelReason;

    // 2) EDIT DRAFT
    // If 'cancel' is false, we treat this as "edit draft"
    // Allowed only if KNJIZENO = 0 and STORNIRAO is null.
    // Editable fields:
    private Long partnerId;
    private String overrideNote; // you can update NAPOMENA for draft if you want
    private List<DispatchItemPatch> items; // full replace of lines

    @Data
    public static class DispatchItemPatch {
        private Long itemId;
        private double quantity;
    }
}
