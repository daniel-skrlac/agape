package hr.agape.partner.service;

import hr.agape.common.dto.PagedResult;
import hr.agape.common.response.ServiceResponse;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.partner.domain.PartnerEntity;
import hr.agape.partner.dto.PartnerCreateRequest;
import hr.agape.partner.dto.PartnerResponseDTO;
import hr.agape.partner.dto.PartnerSearchFilter;
import hr.agape.partner.dto.PartnerUpdateRequest;
import hr.agape.partner.mapper.PartnerApiMapper;
import hr.agape.partner.repository.PartnerRepository;
import hr.agape.user.util.AuthUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.TransactionSynchronizationRegistry;
import jakarta.transaction.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class PartnerService {

    private final PartnerRepository repo;
    private final PartnerApiMapper mapper;
    private final AuthUtil authUtil;
    private final TransactionSynchronizationRegistry tsr;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public PartnerService(PartnerRepository repo, PartnerApiMapper mapper, AuthUtil authUtil, TransactionSynchronizationRegistry tsr) {
        this.repo = repo;
        this.mapper = mapper;
        this.authUtil = authUtil;
        this.tsr = tsr;
    }

    @Transactional
    public ServiceResponse<PartnerResponseDTO> create(PartnerCreateRequest req) {
        try {
            req.setTenantId(authUtil.requireUserId());
            PartnerEntity in = mapper.toEntity(req);
            if (in.getActive() == null) in.setActive(Boolean.TRUE);

            PartnerEntity saved = repo.insert(in);
            PartnerResponseDTO dto = mapper.toResponse(saved);
            return ServiceResponseDirector.successOk(dto, "Partner created.");
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal("Failed to create partner: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponse<PartnerResponseDTO> update(Long id, PartnerUpdateRequest req) {
        try {
            PartnerEntity existing = repo.findById(id);
            if (existing == null) {
                return ServiceResponseDirector.errorNotFound("Partner " + id + " not found.");
            }

            mapper.applyUpdate(req, existing);

            PartnerEntity updated = repo.update(id, existing);
            if (updated == null) {
                return ServiceResponseDirector.errorBadRequest("Update failed for partner " + id);
            }

            PartnerResponseDTO dto = mapper.toResponse(updated);
            return ServiceResponseDirector.successOk(dto, "Partner updated.");
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal("Failed to update partner: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponse<PartnerResponseDTO> getOne(Long id) {
        try {
            PartnerEntity e = repo.findById(id);
            if (e == null) {
                return ServiceResponseDirector.errorNotFound("Partner " + id + " not found.");
            }
            return ServiceResponseDirector.successOk(mapper.toResponse(e), "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to fetch partner: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponse<PagedResult<PartnerResponseDTO>> search(PartnerSearchFilter filter) {
        try {
            long total = repo.countFiltered(filter);
            List<PartnerEntity> items = repo.pageFiltered(filter);

            List<PartnerResponseDTO> dtoItems = items.stream()
                    .map(mapper::toResponse)
                    .collect(Collectors.toList());

            PagedResult<PartnerResponseDTO> result = PagedResult.<PartnerResponseDTO>builder()
                    .items(dtoItems)
                    .page(filter.getPage())
                    .size(filter.getSize())
                    .total(total)
                    .build();

            return ServiceResponseDirector.successOk(result, "OK");
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal("Failed to search partners: " + e.getMessage());
        }
    }
}
