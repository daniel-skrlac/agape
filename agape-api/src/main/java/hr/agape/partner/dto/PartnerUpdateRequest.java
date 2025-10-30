package hr.agape.partner.dto;

import lombok.Data;

@Data
public class PartnerUpdateRequest {
    private Integer statusId;       // STATUSID
    private Integer partnerNumber;  // PARTNERID
    private String taxNumber;       // OIB
    private String name;            // NAZIV
    private String address;         // ADRESA
    private String postalCode;      // PTTBROJ
    private String city;            // PTTMJESTO
    private Boolean active;         // AKTIVAN
}
