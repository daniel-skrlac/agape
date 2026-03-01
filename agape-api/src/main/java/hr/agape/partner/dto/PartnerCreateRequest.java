package hr.agape.partner.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PartnerCreateRequest {
    private Long tenantId;        // KORISNIK_ID

    @NotNull
    private Integer statusId;     // STATUSID

    @NotNull
    private Integer partnerNumber; // PARTNERID

    private String taxNumber;     // OIB
    @NotNull
    private String name;          // NAZIV

    private String address;       // ADRESA
    private String postalCode;    // PTTBROJ
    private String city;          // PTTMJESTO

    private Boolean active;       // AKTIVAN (default true if null)
}
