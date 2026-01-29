package hr.agape.template.service;

import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchBulkResponseDTO;
import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.service.DispatchBookingService;
import hr.agape.template.domain.DispatchTemplateDocEntity;
import hr.agape.template.domain.DispatchTemplateDocItemEntity;
import hr.agape.template.domain.DispatchTemplateEntity;
import hr.agape.template.domain.DispatchTemplateFolderEntity;
import hr.agape.template.domain.DispatchTemplateShareEntity;
import hr.agape.template.dto.*;
import hr.agape.template.enumeration.DispatchTemplateSharePermission;
import hr.agape.template.mapper.DispatchTemplateFolderMapper;
import hr.agape.template.mapper.DispatchTemplateMapper;
import hr.agape.template.mapper.DispatchTemplateShareMapper;
import hr.agape.template.repository.DispatchTemplateFolderRepository;
import hr.agape.template.repository.DispatchTemplateRepository;
import hr.agape.template.repository.DispatchTemplateShareRepository;
import hr.agape.user.domain.UserEntity;
import hr.agape.user.repository.UserRepository;
import hr.agape.user.util.AuthUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@ApplicationScoped
public class DispatchTemplateService {

    private static final ZoneId ZAGREB = ZoneId.of("Europe/Zagreb");

    private final DispatchTemplateFolderRepository folderRepo;
    private final DispatchTemplateRepository templateRepo;
    private final DispatchTemplateShareRepository dispatchTemplateShareRepo;
    private final UserRepository userRepo;

    private final DispatchTemplateFolderMapper folderMapper;
    private final DispatchTemplateMapper templateMapper;
    private final DispatchTemplateShareMapper shareMapper;

    private final DispatchBookingService oracleBooking;
    private final AuthUtil authUtil;

    @Inject
    public DispatchTemplateService(
            DispatchTemplateFolderRepository folderRepo,
            DispatchTemplateRepository templateRepo,
            DispatchTemplateShareRepository dispatchTemplateShareRepo,
            UserRepository userRepo,
            DispatchTemplateFolderMapper folderMapper,
            DispatchTemplateMapper templateMapper,
            DispatchTemplateShareMapper shareMapper,
            DispatchBookingService oracleBooking,
            AuthUtil authUtil
    ) {
        this.folderRepo = folderRepo;
        this.templateRepo = templateRepo;
        this.dispatchTemplateShareRepo = dispatchTemplateShareRepo;
        this.userRepo = userRepo;
        this.folderMapper = folderMapper;
        this.templateMapper = templateMapper;
        this.shareMapper = shareMapper;
        this.oracleBooking = oracleBooking;
        this.authUtil = authUtil;
    }

    // ------------------------------------------------------------
    // TEMPLATES LIST / GET
    // ------------------------------------------------------------

    public ServiceResponseDTO<List<TemplateResponseDTO>> listTemplateHeaders(
            Long folderId,
            String q,
            boolean includeShared,
            boolean rootOnly
    ) {
        try {
            Long userId = authUtil.requireUserId();

            if (rootOnly && folderId != null) {
                return ServiceResponseDirector.errorBadRequest("Use either folderId or rootOnly, not both.");
            }

            if (folderId != null && !folderRepo.belongsToOwner(folderId, userId)) {
                return ServiceResponseDirector.errorBadRequest("Folder not found.");
            }

            List<DispatchTemplateEntity> owned = templateRepo.listHeaders(userId, folderId, q, rootOnly);

            List<DispatchTemplateEntity> shared = List.of();
            if (includeShared && folderId == null) {
                shared = templateRepo.listSharedHeaders(userId, q);
            }

            Set<Long> sharedIds = shared.stream()
                    .map(DispatchTemplateEntity::getId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            var permByTemplateId = dispatchTemplateShareRepo.listForSharedWith(userId).stream()
                    .filter(s -> s.getTemplate() != null && s.getTemplate().getId() != null)
                    .collect(Collectors.toMap(
                            s -> s.getTemplate().getId(),
                            DispatchTemplateShareEntity::getPermission,
                            (a, b) -> (a == DispatchTemplateSharePermission.BOOK || b == DispatchTemplateSharePermission.BOOK)
                                    ? DispatchTemplateSharePermission.BOOK
                                    : DispatchTemplateSharePermission.VIEW
                    ));

            List<DispatchTemplateEntity> all = new ArrayList<>(owned.size() + shared.size());
            all.addAll(owned);
            all.addAll(shared);

            all.sort(Comparator
                    .comparing(DispatchTemplateEntity::getHouseholdSize, Comparator.nullsLast(Comparator.naturalOrder()))
                    .thenComparing(t -> t.getName() == null ? "" : t.getName().toLowerCase())
                    .thenComparing(DispatchTemplateEntity::getId, Comparator.nullsLast(Comparator.reverseOrder())));

            List<TemplateResponseDTO> dto = all.stream()
                    .map(t -> {
                        TemplateResponseDTO out = templateMapper.toDto(t);

                        boolean isShared = sharedIds.contains(t.getId());
                        out.setShared(isShared);

                        if (isShared) out.setSharedPermission(permByTemplateId.get(t.getId()));
                        else out.setSharedPermission(null);

                        return out;
                    })
                    .toList();

            return ServiceResponseDirector.successOk(dto, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to list templates: " + e.getMessage());
        }
    }

    public ServiceResponseDTO<TemplateResponseDTO> getTemplate(Long templateId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFullAccessible(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            return ServiceResponseDirector.successOk(templateMapper.toDto(t), "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to fetch template: " + e.getMessage());
        }
    }

    // ------------------------------------------------------------
    // BOOKING (template defaults + patches + extra docs/items)
    // ------------------------------------------------------------

    public ServiceResponseDTO<DispatchBulkResponseDTO> bookFromTemplateForOnePartner(TemplateBookOneRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFullAccessible(req.getTemplateId(), userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");
            if (t.getDocuments() == null || t.getDocuments().isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("Template has no documents.");
            }

            ensureBookPermissionIfShared(t, userId);

            LocalDate docDate = req.getDocumentDate() != null ? req.getDocumentDate() : LocalDate.now(ZAGREB);

            List<DispatchRequestDTO> bulk = buildRequestsForPartner(
                    req.getWarehouseId(),
                    req.getPartnerId(),
                    docDate,
                    req.getDraftOverride(),
                    req.getDocPatches(),
                    req.getExtraDocuments(),
                    t
            );

            return oracleBooking.bookBulk(bulk);

        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Template booking failed: " + e.getMessage());
        }
    }

    public ServiceResponseDTO<DispatchBulkResponseDTO> bookFromTemplateForManyPartners(TemplateBookManyRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFullAccessible(req.getTemplateId(), userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");
            if (t.getDocuments() == null || t.getDocuments().isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("Template has no documents.");
            }

            ensureBookPermissionIfShared(t, userId);

            LocalDate docDate = req.getDocumentDate() != null ? req.getDocumentDate() : LocalDate.now(ZAGREB);

            List<DispatchRequestDTO> all = new ArrayList<>();
            for (Long partnerId : req.getPartnerIds()) {
                all.addAll(buildRequestsForPartner(
                        req.getWarehouseId(),
                        partnerId,
                        docDate,
                        req.getDraftOverride(),
                        req.getDocPatches(),
                        req.getExtraDocuments(),
                        t
                ));
            }

            return oracleBooking.bookBulk(all);

        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Template bulk booking failed: " + e.getMessage());
        }
    }

    private void ensureBookPermissionIfShared(DispatchTemplateEntity t, Long userId) {
        if (t.getOwner() != null && Objects.equals(t.getOwner().getId(), userId)) return;

        DispatchTemplateShareEntity share = dispatchTemplateShareRepo.findByTemplateAndUser(t.getId(), userId);
        if (share == null || share.getPermission() != DispatchTemplateSharePermission.BOOK) {
            throw new IllegalArgumentException("Template is shared without BOOK permission.");
        }
    }

    // ------------------------------------------------------------
    // SHARES
    // ------------------------------------------------------------

    @Transactional
    public ServiceResponseDTO<TemplateShareResponseDTO> shareTemplate(Long templateId, TemplateShareCreateRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFull(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            UserEntity target = userRepo.findByUsername(req.getUsername());
            if (target == null) return ServiceResponseDirector.errorBadRequest("User not found: " + req.getUsername());

            if (target.getId().equals(userId)) {
                return ServiceResponseDirector.errorBadRequest("Cannot share template to yourself.");
            }

            if (dispatchTemplateShareRepo.existsByTemplateAndUser(templateId, target.getId())) {
                return ServiceResponseDirector.errorBadRequest("Template already shared with this user.");
            }

            DispatchTemplateShareEntity share = new DispatchTemplateShareEntity();
            share.setTemplate(t);
            share.setSharedWith(target);
            share.setPermission(req.getPermission() != null ? req.getPermission() : DispatchTemplateSharePermission.BOOK);
            share.setCreatedAt(OffsetDateTime.now(ZAGREB));
            share.persist();

            return ServiceResponseDirector.successOk(shareMapper.toDto(share), "Template shared.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to share template: " + e.getMessage());
        }
    }

    public ServiceResponseDTO<List<TemplateShareResponseDTO>> listShares(Long templateId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFull(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            List<DispatchTemplateShareEntity> list = dispatchTemplateShareRepo.listForTemplate(templateId);
            return ServiceResponseDirector.successOk(
                    list.stream().map(shareMapper::toDto).toList(),
                    "OK"
            );
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to list shares: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponseDTO<Void> revokeShare(Long templateId, Long shareId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFull(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            DispatchTemplateShareEntity s = DispatchTemplateShareEntity.findById(shareId);
            if (s == null || s.getTemplate() == null || !s.getTemplate().getId().equals(templateId)) {
                return ServiceResponseDirector.errorNotFound("Share not found.");
            }

            s.delete();
            return ServiceResponseDirector.successOk(null, "Share revoked.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to revoke share: " + e.getMessage());
        }
    }

    // ------------------------------------------------------------
    // COPY TEMPLATE (suffix: " - Copy", uniqueness, destination folder)
    // ------------------------------------------------------------

    @Transactional
    public ServiceResponseDTO<TemplateResponseDTO> copyTemplateIntoMyAccount(Long templateId, TemplateCopyRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity src = templateRepo.findFullAccessible(templateId, userId);
            if (src == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            boolean isOwner = src.getOwner() != null && Objects.equals(src.getOwner().getId(), userId);
            if (!isOwner) {
                DispatchTemplateShareEntity share = dispatchTemplateShareRepo.findByTemplateAndUser(templateId, userId);
                if (share == null) return ServiceResponseDirector.errorBadRequest("Template is not shared with you.");
            }

            DispatchTemplateFolderEntity folder = null;
            if (req != null && req.getFolderId() != null) {
                if (!folderRepo.belongsToOwner(req.getFolderId(), userId)) {
                    return ServiceResponseDirector.errorBadRequest("Folder not found.");
                }
                folder = folderRepo.findOwned(req.getFolderId(), userId);
            }

            UserEntity me = userRepo.findById(userId);
            if (me == null) return ServiceResponseDirector.errorUnauthorized("Invalid user.");

            OffsetDateTime now = OffsetDateTime.now(ZAGREB);

            DispatchTemplateEntity copy = new DispatchTemplateEntity();
            copy.setOwner(me);
            copy.setFolder(folder);
            copy.setHouseholdSize(src.getHouseholdSize());

            String desired = (req != null && req.getNewName() != null && !req.getNewName().isBlank())
                    ? req.getNewName().trim()
                    : safeName(src.getName()) + " - Copy";
            copy.setName(makeUniqueTemplateNameForFolder(userId, folder, desired));

            copy.setDescription(src.getDescription());
            copy.setCreatedAt(now);
            copy.setUpdatedAt(now);
            copy.setDocuments(new ArrayList<>());
            copy.persist();

            for (DispatchTemplateDocEntity d : src.getDocuments()) {
                DispatchTemplateDocEntity cd = new DispatchTemplateDocEntity();
                cd.setTemplate(copy);
                cd.setSortOrder(d.getSortOrder());
                cd.setDocumentId(d.getDocumentId());
                cd.setDraft(d.getDraft());
                cd.setDefaultNote(d.getDefaultNote());
                cd.setItems(new ArrayList<>());
                cd.persist();

                if (d.getItems() != null) {
                    for (DispatchTemplateDocItemEntity it : d.getItems()) {
                        DispatchTemplateDocItemEntity ci = new DispatchTemplateDocItemEntity();
                        ci.setTemplateDoc(cd);
                        ci.setSortOrder(it.getSortOrder());
                        ci.setItemId(it.getItemId());
                        ci.setQuantity(it.getQuantity());
                        ci.persist();
                        cd.getItems().add(ci);
                    }
                }

                copy.getDocuments().add(cd);
            }

            DispatchTemplateEntity full = templateRepo.findFull(copy.getId(), userId);
            return ServiceResponseDirector.successOk(templateMapper.toDto(full), "Template copied into your account.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to copy template: " + e.getMessage());
        }
    }

    // ------------------------------------------------------------
    // FOLDERS CRUD
    // ------------------------------------------------------------

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
            if (owner == null) return ServiceResponseDirector.errorUnauthorized("Invalid user.");

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

            f.delete();
            return ServiceResponseDirector.successOk(null, "Folder deleted.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to delete folder: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponseDTO<FolderResponseDTO> copyFolderTree(Long sourceFolderId, FolderCopyRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateFolderEntity src = folderRepo.findOwned(sourceFolderId, userId);
            if (src == null) return ServiceResponseDirector.errorNotFound("Folder not found.");

            DispatchTemplateFolderEntity targetParent = null;
            if (req != null && req.getTargetParentId() != null) {
                targetParent = folderRepo.findOwned(req.getTargetParentId(), userId);
                if (targetParent == null) return ServiceResponseDirector.errorBadRequest("Target folder not found.");
            }

            boolean includeSubfolders = req == null || req.getIncludeSubfolders() == null || req.getIncludeSubfolders();
            boolean includeTemplates = req == null || req.getIncludeTemplates() == null || req.getIncludeTemplates();

            UserEntity me = userRepo.findById(userId);
            if (me == null) return ServiceResponseDirector.errorUnauthorized("Invalid user.");

            OffsetDateTime now = OffsetDateTime.now(ZAGREB);

            DispatchTemplateFolderEntity rootCopy = new DispatchTemplateFolderEntity();
            rootCopy.setOwner(me);
            rootCopy.setParent(targetParent);
            rootCopy.setName(makeUniqueFolderName(userId, targetParent, safeName(src.getName()) + " - Copy"));
            rootCopy.setCreatedAt(now);
            rootCopy.setUpdatedAt(now);
            rootCopy.persist();

            List<DispatchTemplateFolderEntity> allFolders = folderRepo.listForOwner(userId);

            Map<Long, List<DispatchTemplateFolderEntity>> childrenByParentId = allFolders.stream()
                    .filter(f -> f.getParent() != null && f.getParent().getId() != null)
                    .collect(Collectors.groupingBy(f -> f.getParent().getId()));

            Map<Long, DispatchTemplateFolderEntity> folderMap = new HashMap<>();
            folderMap.put(src.getId(), rootCopy);

            Deque<DispatchTemplateFolderEntity> stack = new ArrayDeque<>();
            stack.push(src);

            while (!stack.isEmpty()) {
                DispatchTemplateFolderEntity curOld = stack.pop();
                DispatchTemplateFolderEntity curNew = folderMap.get(curOld.getId());

                if (includeTemplates) {
                    List<DispatchTemplateEntity> templatesInFolder = templateRepo.listByOwnerAndFolder(userId, curOld.getId());
                    for (DispatchTemplateEntity t : templatesInFolder) {
                        copyOwnedTemplateIntoFolder(t.getId(), userId, curNew, now);
                    }
                }

                if (!includeSubfolders) continue;

                List<DispatchTemplateFolderEntity> kids = childrenByParentId.getOrDefault(curOld.getId(), List.of());
                for (DispatchTemplateFolderEntity kidOld : kids) {
                    DispatchTemplateFolderEntity kidNew = new DispatchTemplateFolderEntity();
                    kidNew.setOwner(me);
                    kidNew.setParent(curNew);
                    kidNew.setName(makeUniqueFolderName(userId, curNew, safeName(kidOld.getName()) + " - Copy"));
                    kidNew.setCreatedAt(now);
                    kidNew.setUpdatedAt(now);
                    kidNew.persist();

                    folderMap.put(kidOld.getId(), kidNew);
                    stack.push(kidOld);
                }
            }

            return ServiceResponseDirector.successOk(folderMapper.toDto(rootCopy), "Folder copied.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to copy folder: " + e.getMessage());
        }
    }

    private void copyOwnedTemplateIntoFolder(
            Long templateId,
            Long ownerUserId,
            DispatchTemplateFolderEntity destFolder,
            OffsetDateTime now
    ) {
        DispatchTemplateEntity src = templateRepo.findFull(templateId, ownerUserId);
        if (src == null) throw new IllegalArgumentException("Template not found: " + templateId);

        UserEntity owner = userRepo.findById(ownerUserId);
        if (owner == null) throw new IllegalArgumentException("Invalid user.");

        DispatchTemplateEntity copy = new DispatchTemplateEntity();
        copy.setOwner(owner);
        copy.setFolder(destFolder);
        copy.setHouseholdSize(src.getHouseholdSize());

        String desired = safeName(src.getName()) + " - Copy";
        copy.setName(makeUniqueTemplateNameForFolder(ownerUserId, destFolder, desired));

        copy.setDescription(src.getDescription());
        copy.setCreatedAt(now);
        copy.setUpdatedAt(now);
        copy.setDocuments(new ArrayList<>());
        copy.persist();

        for (DispatchTemplateDocEntity d : src.getDocuments()) {
            DispatchTemplateDocEntity cd = new DispatchTemplateDocEntity();
            cd.setTemplate(copy);
            cd.setSortOrder(d.getSortOrder());
            cd.setDocumentId(d.getDocumentId());
            cd.setDraft(d.getDraft());
            cd.setDefaultNote(d.getDefaultNote());
            cd.setItems(new ArrayList<>());
            cd.persist();

            if (d.getItems() != null) {
                for (DispatchTemplateDocItemEntity it : d.getItems()) {
                    DispatchTemplateDocItemEntity ci = new DispatchTemplateDocItemEntity();
                    ci.setTemplateDoc(cd);
                    ci.setSortOrder(it.getSortOrder());
                    ci.setItemId(it.getItemId());
                    ci.setQuantity(it.getQuantity());
                    ci.persist();
                    cd.getItems().add(ci);
                }
            }

            copy.getDocuments().add(cd);
        }

    }

    // ------------------------------------------------------------
    // TEMPLATES CRUD
    // ------------------------------------------------------------

    @Transactional
    public ServiceResponseDTO<TemplateResponseDTO> createTemplate(TemplateCreateRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            UserEntity owner = userRepo.findById(userId);
            if (owner == null) return ServiceResponseDirector.errorUnauthorized("Invalid user.");

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
            t.setName(makeUniqueTemplateNameForFolder(userId, folder, req.getName().trim()));
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

            if (req.getName() != null) {
                t.setName(makeUniqueTemplateNameForFolder(userId, t.getFolder(), req.getName().trim(), t.getId()));
            }
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

    // ------------------------------------------------------------
    // BUILD REQUESTS (patches + extras)
    // ------------------------------------------------------------

    private static List<DispatchRequestDTO> buildRequestsForPartner(
            Long warehouseId,
            Long partnerId,
            LocalDate docDate,
            Boolean globalDraftOverride,
            List<TemplateBookDocPatchDTO> docPatches,
            List<TemplateBookExtraDocDTO> extraDocs,
            DispatchTemplateEntity t
    ) {
        List<DispatchRequestDTO> out = new ArrayList<>();

        Map<Long, TemplateBookDocPatchDTO> patchByDocId = (docPatches == null ? List.<TemplateBookDocPatchDTO>of() : docPatches)
                .stream()
                .filter(p -> p.getDocumentId() != null)
                .collect(Collectors.toMap(TemplateBookDocPatchDTO::getDocumentId, x -> x, (a, b) -> b));

        for (DispatchTemplateDocEntity d : t.getDocuments()) {
            if (d.getItems() == null || d.getItems().isEmpty()) {
                throw new IllegalArgumentException("Template document " + d.getDocumentId() + " has no items.");
            }

            TemplateBookDocPatchDTO patch = patchByDocId.get(d.getDocumentId());

            Map<Long, BigDecimal> qty = new LinkedHashMap<>();
            for (DispatchTemplateDocItemEntity it : d.getItems()) {
                qty.put(it.getItemId(), it.getQuantity());
            }

            if (patch != null && patch.getRemoveItemIds() != null) {
                for (Long itemId : patch.getRemoveItemIds()) qty.remove(itemId);
            }

            if (patch != null && patch.getSetItems() != null) {
                for (TemplateBookItemDTO s : patch.getSetItems()) {
                    if (s == null || s.getItemId() == null) continue;
                    BigDecimal v = s.getQuantity();
                    if (v == null || v.signum() == 0) qty.remove(s.getItemId());
                    else qty.put(s.getItemId(), v);
                }
            }

            if (patch != null && patch.getAddItems() != null) {
                for (TemplateBookItemDTO a : patch.getAddItems()) {
                    if (a == null || a.getItemId() == null) continue;
                    BigDecimal v = a.getQuantity();
                    if (v == null || v.signum() == 0) continue;
                    qty.merge(a.getItemId(), v, BigDecimal::add);
                }
            }

            if (qty.isEmpty()) {
                throw new IllegalArgumentException("Document " + d.getDocumentId() + " has no items after overrides.");
            }

            DispatchRequestDTO dr = new DispatchRequestDTO();
            dr.setDocumentId(d.getDocumentId());
            dr.setPartnerId(partnerId);
            dr.setWarehouseId(warehouseId);
            dr.setDocumentDate(docDate);

            boolean isDraft = (patch != null && patch.getDraftOverride() != null)
                    ? patch.getDraftOverride()
                    : (globalDraftOverride != null ? globalDraftOverride : Boolean.TRUE.equals(d.getDraft()));
            dr.setDraft(isDraft);

            List<DispatchRequestDTO.DispatchItemRequest> items = new ArrayList<>();
            for (var e : qty.entrySet()) {
                DispatchRequestDTO.DispatchItemRequest line = new DispatchRequestDTO.DispatchItemRequest();
                line.setItemId(e.getKey());
                line.setQuantity(e.getValue().doubleValue());
                items.add(line);
            }

            dr.setItems(items);
            out.add(dr);
        }

        if (extraDocs != null) {
            for (TemplateBookExtraDocDTO ed : extraDocs) {
                if (ed == null || ed.getDocumentId() == null) continue;
                if (ed.getItems() == null || ed.getItems().isEmpty()) {
                    throw new IllegalArgumentException("Extra document " + ed.getDocumentId() + " has no items.");
                }

                DispatchRequestDTO dr = new DispatchRequestDTO();
                dr.setDocumentId(ed.getDocumentId());
                dr.setPartnerId(partnerId);
                dr.setWarehouseId(warehouseId);
                dr.setDocumentDate(docDate);

                Boolean draft = ed.getDraft();
                if (draft == null) draft = globalDraftOverride != null ? globalDraftOverride : Boolean.TRUE;
                dr.setDraft(draft);

                List<DispatchRequestDTO.DispatchItemRequest> items = new ArrayList<>();
                for (TemplateBookItemDTO it : ed.getItems()) {
                    if (it == null || it.getItemId() == null || it.getQuantity() == null) continue;
                    if (it.getQuantity().signum() == 0) continue;

                    DispatchRequestDTO.DispatchItemRequest line = new DispatchRequestDTO.DispatchItemRequest();
                    line.setItemId(it.getItemId());
                    line.setQuantity(it.getQuantity().doubleValue());
                    items.add(line);
                }

                if (items.isEmpty()) {
                    throw new IllegalArgumentException("Extra document " + ed.getDocumentId() + " has no valid items.");
                }

                dr.setItems(items);
                out.add(dr);
            }
        }

        return out;
    }

    // ------------------------------------------------------------
    // NAME UNIQUENESS HELPERS
    // ------------------------------------------------------------

    private String makeUniqueFolderName(Long ownerUserId, DispatchTemplateFolderEntity parent, String desired) {
        Long parentId = parent == null ? null : parent.getId();
        List<String> siblingNames = folderRepo.listChildNames(ownerUserId, parentId);
        return makeUnique(desired, siblingNames);
    }

    private String makeUniqueTemplateNameForFolder(Long ownerUserId, DispatchTemplateFolderEntity folder, String desired) {
        return makeUniqueTemplateNameForFolder(ownerUserId, folder, desired, null);
    }

    private String makeUniqueTemplateNameForFolder(Long ownerUserId, DispatchTemplateFolderEntity folder, String desired, Long excludeTemplateId) {
        Long folderId = folder == null ? null : folder.getId();
        List<String> existingNames = templateRepo.listNamesForOwnerAndFolder(ownerUserId, folderId, excludeTemplateId);
        return makeUnique(desired, existingNames);
    }

    private static String makeUnique(String base, List<String> existing) {
        String normalizedBase = safeName(base).trim();
        if (normalizedBase.isBlank()) normalizedBase = "Untitled";

        Set<String> set = (existing == null ? List.<String>of() : existing)
                .stream()
                .map(s -> s.toLowerCase().trim())
                .collect(Collectors.toSet());

        String candidate = normalizedBase;
        int i = 2;
        while (set.contains(candidate.toLowerCase())) {
            candidate = normalizedBase + " (" + i + ")";
            i++;
        }
        return candidate;
    }

    private static String safeName(String s) {
        return s == null ? "" : s.trim();
    }
}
