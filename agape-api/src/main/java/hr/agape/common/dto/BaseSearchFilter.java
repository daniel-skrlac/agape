package hr.agape.common.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.QueryParam;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class BaseSearchFilter {
    @QueryParam("page")
    @DefaultValue("0")
    @Min(0)
    private int page;

    @QueryParam("size")
    @DefaultValue("10")
    @Min(1)
    @Max(100)
    private int size;
}
