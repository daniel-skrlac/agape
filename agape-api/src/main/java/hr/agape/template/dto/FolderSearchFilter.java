package hr.agape.template.dto;

import hr.agape.common.dto.BaseSearchFilter;
import jakarta.ws.rs.QueryParam;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class FolderSearchFilter extends BaseSearchFilter {
    @QueryParam("q")
    private String q;
}
