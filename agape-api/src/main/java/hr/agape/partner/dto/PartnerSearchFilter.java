package hr.agape.partner.dto;

import hr.agape.common.dto.BaseSearchFilter;
import jakarta.ws.rs.QueryParam;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerSearchFilter extends BaseSearchFilter {
    @QueryParam("tenantId")
    private Long tenantId;          // maps to KORISNIK_ID

    @QueryParam("statusId")
    private Integer statusId;       // maps to STATUSID

    @QueryParam("nameContains")
    private String nameContains;    // maps to NAZIV like '%x%'

    @QueryParam("taxNumber")
    private String taxNumber;       // maps to OIB (= exact match)

    @QueryParam("activeOnly")
    private Boolean activeOnly;     // filters NVL(AKTIVAN,1)=1 when true
}
