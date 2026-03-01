package hr.agape.template.service;

import hr.agape.common.dto.BaseSearchFilter;
import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.template.domain.DispatchTemplateEntity;
import hr.agape.template.domain.DispatchTemplateShareEntity;
import hr.agape.template.dto.TemplateShareCreateRequestDTO;
import hr.agape.template.dto.TemplateShareResponseDTO;
import hr.agape.template.mapper.DispatchTemplateShareMapper;
import hr.agape.template.repository.DispatchTemplateRepository;
import hr.agape.template.repository.DispatchTemplateShareRepository;
import hr.agape.user.domain.UserEntity;
import hr.agape.user.repository.UserRepository;
import hr.agape.user.util.AuthUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.List;

@ApplicationScoped
public class DispatchTemplateShareService {

    private final DispatchTemplateShareRepository dispatchTemplateShareRepo;
    private final DispatchTemplateRepository templateRepo;
    private final UserRepository userRepo;

    private final AuthUtil authUtil;
    private final DispatchTemplateShareMapper shareMapper;

    @Inject
    public DispatchTemplateShareService(DispatchTemplateShareRepository dispatchTemplateShareRepo,
                                        DispatchTemplateRepository templateRepo, UserRepository userRepo,
                                        AuthUtil authUtil, DispatchTemplateShareMapper shareMapper) {
        this.dispatchTemplateShareRepo = dispatchTemplateShareRepo;
        this.templateRepo = templateRepo;
        this.userRepo = userRepo;
        this.authUtil = authUtil;
        this.shareMapper = shareMapper;
    }

    @Transactional
    public ServiceResponseDTO<TemplateShareResponseDTO> shareTemplate(Long templateId, TemplateShareCreateRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findOwned(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            UserEntity target = userRepo.findByUsername(req.getUsername());
            if (target == null) return ServiceResponseDirector.errorBadRequest("User not found: " + req.getUsername());

            if (target.getId().equals(userId)) {
                return ServiceResponseDirector.errorBadRequest("Cannot share template to yourself.");
            }

            if (dispatchTemplateShareRepo.existsByTemplateAndUser(templateId, target.getId())) {
                return ServiceResponseDirector.errorBadRequest("Template already shared with this user.");
            }

            DispatchTemplateShareEntity share = shareMapper.toEntity(req, t, target);
            share.persist();

            return ServiceResponseDirector.successOk(shareMapper.toDto(share), "Template shared.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to share template.");
        }
    }

    public ServiceResponseDTO<PagedResultDTO<TemplateShareResponseDTO>> listShares(Long templateId, BaseSearchFilter f) {
        try {
            Long userId = authUtil.requireUserId();

            if (templateRepo.isNotOwnedBy(templateId, userId)) {
                return ServiceResponseDirector.errorNotFound("Template not found.");
            }

            int page = (f == null) ? 0 : f.getPage();
            int size = (f == null) ? 10 : f.getSize();

            long total = dispatchTemplateShareRepo.countForTemplate(templateId);
            List<DispatchTemplateShareEntity> shares = dispatchTemplateShareRepo.pageForTemplate(templateId, page, size);

            PagedResultDTO<TemplateShareResponseDTO> result = PagedResultDTO.<TemplateShareResponseDTO>builder()
                    .items(shares.stream().map(shareMapper::toDto).toList())
                    .page(page)
                    .size(size)
                    .total(total)
                    .build();

            return ServiceResponseDirector.successOk(result, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to list shares.");
        }
    }

    @Transactional
    public ServiceResponseDTO<Void> revokeShare(Long templateId, Long shareId) {
        try {
            Long userId = authUtil.requireUserId();

            if (templateRepo.isNotOwnedBy(templateId, userId)) {
                return ServiceResponseDirector.errorNotFound("Template not found.");
            }

            DispatchTemplateShareEntity s = dispatchTemplateShareRepo.findById(shareId);
            if (s == null || s.getTemplate() == null || !s.getTemplate().getId().equals(templateId)) {
                return ServiceResponseDirector.errorNotFound("Share not found.");
            }

            s.delete();
            return ServiceResponseDirector.successOk(null, "Share revoked.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to revoke share.");
        }
    }
}
