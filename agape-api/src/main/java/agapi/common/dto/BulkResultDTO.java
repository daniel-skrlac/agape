package agapi.common.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BulkResultDTO<T> {
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ItemResult<R> {
        private int index;
        private boolean success;
        private R data;
        private String error;
    }

    private List<ItemResult<T>> results;
}
