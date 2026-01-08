package hr.agape.template.service;

import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.dto.DispatchResponseDTO;
import hr.agape.dispatch.service.DispatchBookingService;
import hr.agape.template.domain.DispatchTemplateDocEntity;
import hr.agape.template.domain.DispatchTemplateDocItemEntity;
import hr.agape.template.domain.DispatchTemplateEntity;
import hr.agape.template.domain.DispatchTemplateFolderEntity;
import hr.agape.template.dto.FolderCreateRequestDTO;
import hr.agape.template.dto.FolderRenameRequestDTO;
import hr.agape.template.dto.FolderResponseDTO;
import hr.agape.template.dto.TemplateBookManyRequestDTO;
import hr.agape.template.dto.TemplateBookOneRequestDTO;
import hr.agape.template.dto.TemplateCreateRequestDTO;
import hr.agape.template.dto.TemplateDocUpsertRequestDTO;
import hr.agape.template.dto.TemplateItemUpsertRequestDTO;
import hr.agape.template.dto.TemplateResponseDTO;
import hr.agape.template.dto.TemplateUpdateRequestDTO;
import hr.agape.template.mapper.DispatchTemplateFolderMapper;
import hr.agape.template.mapper.DispatchTemplateMapper;
import hr.agape.template.repository.DispatchTemplateFolderRepository;
import hr.agape.template.repository.DispatchTemplateRepository;
import hr.agape.user.domain.UserEntity;
import hr.agape.user.repository.UserRepository;
import hr.agape.user.util.AuthUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class DispatchTemplateService {

    private static final ZoneId ZAGREB = ZoneId.of("Europe/Zagreb");

    private final DispatchTemplateFolderRepository folderRepo;
    private final DispatchTemplateRepository templateRepo;
    private final UserRepository userRepo;

    private final DispatchTemplateFolderMapper folderMapper;
    private final DispatchTemplateMapper templateMapper;

    private final DispatchBookingService oracleBooking;
    private final AuthUtil authUtil;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public DispatchTemplateService(
            DispatchTemplateFolderRepository folderRepo,
            DispatchTemplateRepository templateRepo,
            UserRepository userRepo,
            DispatchTemplateFolderMapper folderMapper,
            DispatchTemplateMapper templateMapper,
            DispatchBookingService oracleBooking,
            AuthUtil authUtil
    ) {
        this.folderRepo = folderRepo;
        this.templateRepo = templateRepo;
        this.userRepo = userRepo;
        this.folderMapper = folderMapper;
        this.templateMapper = templateMapper;
        this.oracleBooking = oracleBooking;
        this.authUtil = authUtil;
    }

    public ServiceResponseDTO<List<FolderResponseDTO>> listFolders() {
        try {
            Long userId = authUtil.requireUserId();
            List<DispatchTemplateFolderEntity> list = folderRepo.listForOwner(userId);
            return ServiceResponseDirector.successOk(
                    list.stream().map(folderMapper::toDto).toList(),
                    "OK"
            );
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to list folders: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponseDTO<FolderResponseDTO> createFolder(FolderCreateRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            UserEntity owner = userRepo.findById(userId);
            if (owner == null) return ServiceResponseDirector.errorBadRequest("Invalid user.");

            DispatchTemplateFolderEntity parent = null;
            if (req.getParentId() != null) {
                parent = folderRepo.findOwned(req.getParentId(), userId);
                if (parent == null) return ServiceResponseDirector.errorBadRequest("Parent folder not found.");
            }

            OffsetDateTime now = OffsetDateTime.now(ZAGREB);

            DispatchTemplateFolderEntity f = new DispatchTemplateFolderEntity();
            f.setOwner(owner);
            f.setParent(parent);
            f.setName(req.getName().trim());
            f.setCreatedAt(now);
            f.setUpdatedAt(now);
            f.persist();

            return ServiceResponseDirector.successOk(folderMapper.toDto(f), "Folder created.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to create folder: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponseDTO<FolderResponseDTO> renameFolder(Long folderId, FolderRenameRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateFolderEntity f = folderRepo.findOwned(folderId, userId);
            if (f == null) return ServiceResponseDirector.errorNotFound("Folder not found.");

            f.setName(req.getName().trim());
            f.setUpdatedAt(OffsetDateTime.now(ZAGREB));

            return ServiceResponseDirector.successOk(folderMapper.toDto(f), "Folder renamed.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to rename folder: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponseDTO<Void> deleteFolder(Long folderId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateFolderEntity f = folderRepo.findOwned(folderId, userId);
            if (f == null) return ServiceResponseDirector.errorNotFound("Folder not found.");

            // if you want: enforce "cannot delete non-empty folder" here, otherwise rely on FK cascade/orphans
            f.delete();
            return ServiceResponseDirector.successOk(null, "Folder deleted.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to delete folder: " + e.getMessage());
        }
    }

    public ServiceResponseDTO<List<TemplateResponseDTO>> listTemplateHeaders(Long folderId, String q) {
        try {
            Long userId = authUtil.requireUserId();

            if (folderId != null && !folderRepo.belongsToOwner(folderId, userId)) {
                return ServiceResponseDirector.errorBadRequest("Folder not found.");
            }

            List<DispatchTemplateEntity> list = templateRepo.listHeaders(userId, folderId, q);
            return ServiceResponseDirector.successOk(
                    list.stream().map(templateMapper::toDto).toList(),
                    "OK"
            );
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to list templates: " + e.getMessage());
        }
    }

    public ServiceResponseDTO<TemplateResponseDTO> getTemplate(Long templateId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFull(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            return ServiceResponseDirector.successOk(templateMapper.toDto(t), "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to fetch template: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponseDTO<TemplateResponseDTO> createTemplate(TemplateCreateRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            UserEntity owner = userRepo.findById(userId);
            if (owner == null) return ServiceResponseDirector.errorBadRequest("Invalid user.");

            DispatchTemplateFolderEntity folder = null;
            if (req.getFolderId() != null) {
                folder = folderRepo.findOwned(req.getFolderId(), userId);
                if (folder == null) return ServiceResponseDirector.errorBadRequest("Folder not found.");
            }

            OffsetDateTime now = OffsetDateTime.now(ZAGREB);

            DispatchTemplateEntity t = new DispatchTemplateEntity();
            t.setOwner(owner);
            t.setFolder(folder);
            t.setHouseholdSize(req.getHouseholdSize().shortValue());
            t.setName(req.getName().trim());
            t.setDescription(req.getDescription());
            t.setCreatedAt(now);
            t.setUpdatedAt(now);
            t.setDocuments(new ArrayList<>());
            t.persist();

            DispatchTemplateEntity full = templateRepo.findFull(t.getId(), userId);
            return ServiceResponseDirector.successOk(templateMapper.toDto(full), "Template created.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to create template: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponseDTO<TemplateResponseDTO> updateTemplate(Long templateId, TemplateUpdateRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFull(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            if (req.getName() != null) t.setName(req.getName().trim());
            if (req.getDescription() != null) t.setDescription(req.getDescription());
            if (req.getHouseholdSize() != null) t.setHouseholdSize(req.getHouseholdSize().shortValue());

            if (req.getFolderId() != null) {
                DispatchTemplateFolderEntity folder = folderRepo.findOwned(req.getFolderId(), userId);
                if (folder == null) return ServiceResponseDirector.errorBadRequest("Folder not found.");
                t.setFolder(folder);
            }

            t.setUpdatedAt(OffsetDateTime.now(ZAGREB));

            DispatchTemplateEntity full = templateRepo.findFull(templateId, userId);
            return ServiceResponseDirector.successOk(templateMapper.toDto(full), "Template updated.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to update template: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponseDTO<Void> deleteTemplate(Long templateId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFull(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            t.delete();
            return ServiceResponseDirector.successOk(null, "Template deleted.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to delete template: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponseDTO<TemplateResponseDTO> upsertTemplateDoc(Long templateId, TemplateDocUpsertRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFull(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            if (t.getDocuments() == null) t.setDocuments(new ArrayList<>());

            DispatchTemplateDocEntity doc = null;
            for (DispatchTemplateDocEntity d : t.getDocuments()) {
                if (d.getDocumentId() != null && d.getDocumentId().equals(req.getDocumentId())) {
                    doc = d;
                    break;
                }
            }

            if (doc == null) {
                doc = new DispatchTemplateDocEntity();
                doc.setTemplate(t);
                doc.setDocumentId(req.getDocumentId());
                doc.setItems(new ArrayList<>());
                t.getDocuments().add(doc);
            }

            doc.setSortOrder(req.getSortOrder());
            doc.setDraft(req.getDraft());
            doc.setDefaultNote(req.getDefaultNote());

            t.setUpdatedAt(OffsetDateTime.now(ZAGREB));

            DispatchTemplateEntity full = templateRepo.findFull(templateId, userId);
            return ServiceResponseDirector.successOk(templateMapper.toDto(full), "Template document saved.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to save template document: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponseDTO<TemplateResponseDTO> replaceTemplateDocItems(
            Long templateId,
            Long templateDocId,
            List<TemplateItemUpsertRequestDTO> items
    ) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFull(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");
            if (t.getDocuments() == null) return ServiceResponseDirector.errorBadRequest("Template has no documents.");

            DispatchTemplateDocEntity doc = null;
            for (DispatchTemplateDocEntity d : t.getDocuments()) {
                if (d.getId() != null && d.getId().equals(templateDocId)) {
                    doc = d;
                    break;
                }
            }
            if (doc == null) return ServiceResponseDirector.errorBadRequest("Template document not found.");

            if (doc.getItems() == null) doc.setItems(new ArrayList<>());
            else doc.getItems().clear();

            for (TemplateItemUpsertRequestDTO it : items) {
                DispatchTemplateDocItemEntity ent = new DispatchTemplateDocItemEntity();
                ent.setTemplateDoc(doc);
                ent.setItemId(it.getItemId());
                ent.setQuantity(it.getQuantity());
                ent.setSortOrder(it.getSortOrder());
                doc.getItems().add(ent);
            }

            t.setUpdatedAt(OffsetDateTime.now(ZAGREB));

            DispatchTemplateEntity full = templateRepo.findFull(templateId, userId);
            return ServiceResponseDirector.successOk(templateMapper.toDto(full), "Template items replaced.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to replace template items: " + e.getMessage());
        }
    }

    public ServiceResponseDTO<List<DispatchResponseDTO>> bookFromTemplateForOnePartner(TemplateBookOneRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFull(req.getTemplateId(), userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");
            if (t.getDocuments() == null || t.getDocuments().isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("Template has no documents.");
            }

            LocalDate docDate = req.getDocumentDate() != null
                    ? req.getDocumentDate()
                    : LocalDate.now(ZAGREB);

            List<DispatchRequestDTO> bulk = buildRequestsForPartner(
                    req.getPartnerId(),
                    docDate,
                    req.getDraftOverride(),
                    t
            );

            return oracleBooking.bookBulk(bulk);
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Template booking failed: " + e.getMessage());
        }
    }

    public ServiceResponseDTO<List<DispatchResponseDTO>> bookFromTemplateForManyPartners(TemplateBookManyRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFull(req.getTemplateId(), userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");
            if (t.getDocuments() == null || t.getDocuments().isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("Template has no documents.");
            }

            LocalDate docDate = req.getDocumentDate() != null
                    ? req.getDocumentDate()
                    : LocalDate.now(ZAGREB);

            List<DispatchRequestDTO> all = new ArrayList<>();
            for (Long partnerId : req.getPartnerIds()) {
                all.addAll(buildRequestsForPartner(partnerId, docDate, req.getDraftOverride(), t));
            }

            return oracleBooking.bookBulk(all);
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Template bulk booking failed: " + e.getMessage());
        }
    }

    private static List<DispatchRequestDTO> buildRequestsForPartner(
            Long partnerId,
            LocalDate docDate,
            Boolean draftOverride,
            DispatchTemplateEntity t
    ) {
        List<DispatchRequestDTO> out = new ArrayList<>();

        for (DispatchTemplateDocEntity d : t.getDocuments()) {
            if (d.getItems() == null || d.getItems().isEmpty()) {
                throw new IllegalArgumentException("Template document " + d.getDocumentId() + " has no items.");
            }

            DispatchRequestDTO dr = new DispatchRequestDTO();
            dr.setDocumentId(d.getDocumentId());
            dr.setPartnerId(partnerId);
            dr.setDocumentDate(docDate);

            boolean isDraft = (draftOverride != null)
                    ? draftOverride
                    : Boolean.TRUE.equals(d.getDraft());
            dr.setDraft(isDraft);

            List<DispatchRequestDTO.DispatchItemRequest> items = new ArrayList<>();
            for (DispatchTemplateDocItemEntity it : d.getItems()) {
                DispatchRequestDTO.DispatchItemRequest line = new DispatchRequestDTO.DispatchItemRequest();
                line.setItemId(it.getItemId());
                line.setQuantity(it.getQuantity().doubleValue());
                items.add(line);
            }

            dr.setItems(items);
            out.add(dr);
        }

        return out;
    }
}
