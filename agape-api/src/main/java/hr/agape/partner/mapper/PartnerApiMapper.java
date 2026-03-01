package hr.agape.partner.mapper;

import hr.agape.partner.domain.PartnerEntity;
import hr.agape.partner.dto.PartnerCreateRequest;
import hr.agape.partner.dto.PartnerResponseDTO;
import hr.agape.partner.dto.PartnerUpdateRequest;
import org.mapstruct.*;

@Mapper(componentModel = "cdi")
public interface PartnerApiMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(source = "tenantId",       target = "tenantId")
    @Mapping(source = "statusId",       target = "statusId")
    @Mapping(source = "partnerNumber",  target = "partnerNumber")
    @Mapping(source = "taxNumber",      target = "taxNumber")
    @Mapping(source = "name",           target = "name")
    @Mapping(source = "address",        target = "address")
    @Mapping(source = "postalCode",     target = "postalCode")
    @Mapping(source = "city",           target = "city")
    @Mapping(source = "active",         target = "active")
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    PartnerEntity toEntity(PartnerCreateRequest req);

    @BeanMapping(ignoreByDefault = true)
    @Mapping(source = "statusId",      target = "statusId")
    @Mapping(source = "partnerNumber", target = "partnerNumber")
    @Mapping(source = "taxNumber",     target = "taxNumber")
    @Mapping(source = "name",          target = "name")
    @Mapping(source = "address",       target = "address")
    @Mapping(source = "postalCode",    target = "postalCode")
    @Mapping(source = "city",          target = "city")
    @Mapping(source = "active",        target = "active")
    void applyUpdate(PartnerUpdateRequest req, @MappingTarget PartnerEntity target);

    @Mapping(source = "id",            target = "id")
    @Mapping(source = "tenantId",      target = "tenantId")
    @Mapping(source = "statusId",      target = "statusId")
    @Mapping(source = "partnerNumber", target = "partnerNumber")
    @Mapping(source = "taxNumber",     target = "taxNumber")
    @Mapping(source = "name",          target = "name")
    @Mapping(source = "address",       target = "address")
    @Mapping(source = "postalCode",    target = "postalCode")
    @Mapping(source = "city",          target = "city")
    @Mapping(source = "active",        target = "active")
    @Mapping(source = "createdAt",     target = "createdAt")
    @Mapping(source = "updatedAt",     target = "updatedAt")
    PartnerResponseDTO toResponse(PartnerEntity e);
}
