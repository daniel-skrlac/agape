package hr.agape.template.service;

import hr.agape.common.dto.BaseSearchFilter;
import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchBulkResponseDTO;
import hr.agape.dispatch.dto.DispatchRequestDTO;
import hr.agape.dispatch.service.DispatchBookingService;
import hr.agape.item.dto.ItemDescriptorResponseDTO;
import hr.agape.item.service.ItemDirectoryService;
import hr.agape.template.domain.DispatchTemplateDocEntity;
import hr.agape.template.domain.DispatchTemplateDocItemEntity;
import hr.agape.template.domain.DispatchTemplateEntity;
import hr.agape.template.domain.DispatchTemplateFolderEntity;
import hr.agape.template.domain.DispatchTemplateShareEntity;
import hr.agape.template.dto.TemplateBookManyRequestDTO;
import hr.agape.template.dto.TemplateBookOneRequestDTO;
import hr.agape.template.dto.TemplateCopyRequestDTO;
import hr.agape.template.dto.TemplateCreateRequestDTO;
import hr.agape.template.dto.TemplateDocResponseDTO;
import hr.agape.template.dto.TemplateDocUpsertRequestDTO;
import hr.agape.template.dto.TemplateItemResponseDTO;
import hr.agape.template.dto.TemplateItemUpsertRequestDTO;
import hr.agape.template.dto.TemplateMoveRequestDTO;
import hr.agape.template.dto.TemplateResponseDTO;
import hr.agape.template.dto.TemplateUpdateRequestDTO;
import hr.agape.template.enumeration.DispatchTemplateSharePermission;
import hr.agape.template.enumeration.TemplateListScope;
import hr.agape.template.integration.TemplateBookingRequestBuilder;
import hr.agape.template.mapper.DispatchTemplateMapper;
import hr.agape.template.repository.DispatchTemplateDocItemRepository;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class DispatchTemplateService {

    private final DispatchTemplateFolderRepository folderRepo;
    private final DispatchTemplateRepository templateRepo;
    private final DispatchTemplateShareRepository dispatchTemplateShareRepo;
    private final DispatchTemplateDocItemRepository docItemRepo;

    private final UserRepository userRepo;

    private final DispatchTemplateMapper templateMapper;

    private final TemplateNamingService templateNamingService;

    private final DispatchBookingService oracleBooking;
    private final AuthUtil authUtil;

    private final TemplateBookingRequestBuilder bookingRequestBuilder;

    private final ItemDirectoryService itemDirectoryService;

    @Inject
    public DispatchTemplateService(
            DispatchTemplateFolderRepository folderRepo,
            DispatchTemplateRepository templateRepo,
            DispatchTemplateShareRepository dispatchTemplateShareRepo, DispatchTemplateDocItemRepository docItemRepo,
            UserRepository userRepo,
            DispatchTemplateMapper templateMapper, TemplateNamingService templateNamingService,
            DispatchBookingService oracleBooking,
            AuthUtil authUtil, TemplateBookingRequestBuilder bookingRequestBuilder, ItemDirectoryService itemDirectoryService
    ) {
        this.folderRepo = folderRepo;
        this.templateRepo = templateRepo;
        this.dispatchTemplateShareRepo = dispatchTemplateShareRepo;
        this.docItemRepo = docItemRepo;
        this.userRepo = userRepo;
        this.templateMapper = templateMapper;
        this.templateNamingService = templateNamingService;
        this.oracleBooking = oracleBooking;
        this.authUtil = authUtil;
        this.bookingRequestBuilder = bookingRequestBuilder;
        this.itemDirectoryService = itemDirectoryService;
    }

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

            if (folderId != null && folderRepo.doesNotBelongToOwner(folderId, userId)) {
                return ServiceResponseDirector.errorBadRequest("Folder not found.");
            }

            List<DispatchTemplateEntity> owned = templateRepo.listHeaders(userId, folderId, q, rootOnly);
            List<DispatchTemplateEntity> shared =
                    (!includeShared || folderId != null)
                            ? List.of()
                            : templateRepo.listSharedHeaders(userId, q);

            Set<Long> sharedIds = shared.stream()
                    .map(DispatchTemplateEntity::getId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            Map<Long, DispatchTemplateSharePermission> permissionByTemplateId =
                    sharedIds.isEmpty()
                            ? Map.of()
                            : loadSharedPermissions(userId, sharedIds);

            List<DispatchTemplateEntity> all = mergeAndSortTemplates(owned, shared);

            List<TemplateResponseDTO> dto = mapTemplateHeaders(all, sharedIds, permissionByTemplateId);

            return ServiceResponseDirector.successOk(dto, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to list templates.");
        }
    }

    public ServiceResponseDTO<PagedResultDTO<TemplateResponseDTO>> listTemplateHeadersPaged(
            Long folderId,
            String q,
            TemplateListScope scope,
            boolean rootOnly,
            BaseSearchFilter filter
    ) {
        try {
            Long userId = authUtil.requireUserId();

            TemplateListScope effectiveScope = (scope == null) ? TemplateListScope.ALL : scope;

            int page = (filter == null) ? 0 : Math.max(0, filter.getPage());
            int size = (filter == null) ? 20 : Math.max(1, Math.min(filter.getSize(), 100));

            if (rootOnly && folderId != null) {
                return ServiceResponseDirector.errorBadRequest("Use either folderId or rootOnly, not both.");
            }

            if (folderId != null && effectiveScope == TemplateListScope.SHARED) {
                return ServiceResponseDirector.errorBadRequest("folderId is not supported for SHARED scope.");
            }

            if (folderId != null && folderRepo.doesNotBelongToOwner(folderId, userId)) {
                return ServiceResponseDirector.errorBadRequest("Folder not found.");
            }

            long total = templateRepo.countAccessibleHeaders(userId, folderId, q, rootOnly, effectiveScope);
            List<DispatchTemplateEntity> rows = templateRepo.pageAccessibleHeaders(userId, folderId, q, rootOnly, effectiveScope, page, size);

            Set<Long> pageIds = rows.stream()
                    .map(DispatchTemplateEntity::getId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            Map<Long, DispatchTemplateSharePermission> permissionByTemplateId =
                    (effectiveScope == TemplateListScope.OWNED || pageIds.isEmpty())
                            ? Map.of()
                            : loadSharedPermissions(userId, pageIds);

            Set<Long> sharedIds =
                    (effectiveScope == TemplateListScope.SHARED)
                            ? pageIds
                            : permissionByTemplateId.keySet();

            List<TemplateResponseDTO> items = mapTemplateHeaders(rows, sharedIds, permissionByTemplateId);

            PagedResultDTO<TemplateResponseDTO> result = PagedResultDTO.<TemplateResponseDTO>builder()
                    .items(items)
                    .page(page)
                    .size(size)
                    .total(total)
                    .build();

            return ServiceResponseDirector.successOk(result, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to list templates.");
        }
    }

    public ServiceResponseDTO<TemplateResponseDTO> getTemplate(Long templateId, boolean includeItemMeta) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFullAccessible(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            TemplateResponseDTO dto = includeItemMeta
                    ? toTemplateDtoWithItemMeta(t)
                    : templateMapper.toDto(t);

            return ServiceResponseDirector.successOk(dto, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to fetch template.");
        }
    }

    public ServiceResponseDTO<DispatchBulkResponseDTO> bookFromTemplateForOnePartner(TemplateBookOneRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFullAccessible(req.getTemplateId(), userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");
            if (t.getDocuments() == null || t.getDocuments().isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("Template has no documents.");
            }

            boolean draft = req.getDraftMode().asDraftFlag();

            List<DispatchRequestDTO> bulk = bookingRequestBuilder.buildRequestsForPartner(
                    req.getWarehouseId(),
                    req.getPartnerId(),
                    draft,
                    req.getDocumentDate(),
                    req.getNote(),          // ✅ NEW
                    req.getDocPatches(),
                    req.getExtraItems(),
                    req.getExtraDocs(),
                    t
            );

            return oracleBooking.bookBulk(bulk);

        } catch (IllegalArgumentException e) {
            return ServiceResponseDirector.errorBadRequest(e.getMessage());
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Template booking failed.");
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

            boolean draft = req.getDraftMode().asDraftFlag();

            List<DispatchRequestDTO> all = new ArrayList<>();
            for (Long partnerId : req.getPartnerIds()) {
                all.addAll(bookingRequestBuilder.buildRequestsForPartner(
                        req.getWarehouseId(),
                        partnerId,
                        draft,
                        req.getDocumentDate(),
                        req.getNote(),
                        req.getDocPatches(),
                        req.getExtraItems(),
                        req.getExtraDocs(),
                        t
                ));
            }

            return oracleBooking.bookBulk(all);

        } catch (IllegalArgumentException e) {
            return ServiceResponseDirector.errorBadRequest(e.getMessage());
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Template bulk booking failed.");
        }
    }

    @Transactional
    public ServiceResponseDTO<TemplateResponseDTO> copyTemplateIntoMyAccount(Long templateId, TemplateCopyRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity source = templateRepo.findFullAccessible(templateId, userId);
            if (source == null) {
                return ServiceResponseDirector.errorNotFound("Template not found.");
            }

            boolean isOwner = source.getOwner() != null && Objects.equals(source.getOwner().getId(), userId);
            if (!isOwner) {
                DispatchTemplateShareEntity share = dispatchTemplateShareRepo.findByTemplateAndUser(templateId, userId);
                if (share == null) {
                    return ServiceResponseDirector.errorBadRequest("Template is not shared with you.");
                }
            }

            DispatchTemplateFolderEntity targetFolder = null;
            Long targetFolderId = (req != null) ? req.getFolderId() : null;
            if (targetFolderId != null) {
                targetFolder = folderRepo.findOwned(targetFolderId, userId);
                if (targetFolder == null) {
                    return ServiceResponseDirector.errorBadRequest("Folder not found.");
                }
            }

            UserEntity me = userRepo.findById(userId);
            if (me == null) {
                return ServiceResponseDirector.errorUnauthorized("Invalid user.");
            }

            DispatchTemplateEntity copy = createTemplateCopyShell(source, req, me, targetFolder, userId);
            copyTemplateDocuments(source, copy);

            DispatchTemplateEntity fullCopy = templateRepo.findFull(copy.getId(), userId);
            return ServiceResponseDirector.successOk(templateMapper.toDto(fullCopy), "Template copied into your account.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to copy template.");
        }
    }

    @Transactional
    public ServiceResponseDTO<Void> deleteTemplateDoc(Long templateId, Long templateDocId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity template = templateRepo.findFull(templateId, userId);
            if (template == null) {
                return ServiceResponseDirector.errorNotFound("Template not found.");
            }

            Set<DispatchTemplateDocEntity> docs = template.getDocuments();
            if (docs == null || docs.isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("Template has no documents.");
            }

            DispatchTemplateDocEntity doc = docs.stream()
                    .filter(d -> Objects.equals(d.getId(), templateDocId))
                    .findFirst()
                    .orElse(null);

            if (doc == null) {
                return ServiceResponseDirector.errorNotFound("Template document not found.");
            }

            docs.remove(doc);

            return ServiceResponseDirector.successOk(null, "Template document deleted.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to delete template document.");
        }
    }

    @Transactional
    public ServiceResponseDTO<TemplateResponseDTO> createTemplate(TemplateCreateRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            UserEntity owner = userRepo.findById(userId);
            if (owner == null) {
                return ServiceResponseDirector.errorUnauthorized("Invalid user.");
            }

            Long folderId = req.getFolderId();
            DispatchTemplateFolderEntity folder = (folderId == null) ? null : folderRepo.findOwned(folderId, userId);
            if (folderId != null && folder == null) {
                return ServiceResponseDirector.errorBadRequest("Folder not found.");
            }

            String requestedName = req.getName().trim();

            DispatchTemplateEntity template = new DispatchTemplateEntity();
            template.setOwner(owner);
            template.setFolder(folder);
            template.setHouseholdSize(req.getHouseholdSize().shortValue());
            template.setName(templateNamingService.makeUniqueTemplateNameForFolder(userId, folder, requestedName));
            template.setDescription(req.getDescription());
            template.setDocuments(new LinkedHashSet<>());
            template.persist();

            DispatchTemplateEntity fullTemplate = templateRepo.findFull(template.getId(), userId);
            return ServiceResponseDirector.successOk(templateMapper.toDto(fullTemplate), "Template created.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to create template.");
        }
    }

    @Transactional
    public ServiceResponseDTO<TemplateResponseDTO> updateTemplate(Long templateId, TemplateUpdateRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFull(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            if (req.getName() != null) {
                t.setName(templateNamingService.
                        makeUniqueTemplateNameForFolder(userId, t.getFolder(), req.getName().trim(), t.getId()));
            }
            if (req.getDescription() != null) t.setDescription(req.getDescription());
            if (req.getHouseholdSize() != null) t.setHouseholdSize(req.getHouseholdSize().shortValue());

            if (req.getFolderId() != null) {
                DispatchTemplateFolderEntity folder = folderRepo.findOwned(req.getFolderId(), userId);
                if (folder == null) return ServiceResponseDirector.errorBadRequest("Folder not found.");

                boolean changed = t.getFolder() == null || t.getFolder().getId() == null ||
                        !t.getFolder().getId().equals(folder.getId());

                t.setFolder(folder);

                if (changed && t.getName() != null) {
                    t.setName(templateNamingService.makeUniqueTemplateNameForFolder(userId, folder, t.getName(), t.getId()));
                }
            }

            DispatchTemplateEntity full = templateRepo.findFull(templateId, userId);
            return ServiceResponseDirector.successOk(templateMapper.toDto(full), "Template updated.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to update template.");
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
            return ServiceResponseDirector.errorInternal("Failed to delete template.");
        }
    }

    @Transactional
    public ServiceResponseDTO<TemplateResponseDTO> upsertTemplateDoc(Long templateId, TemplateDocUpsertRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity template = templateRepo.findFull(templateId, userId);
            if (template == null) {
                return ServiceResponseDirector.errorNotFound("Template not found.");
            }

            Long documentId = req.getDocumentId();
            if (documentId == null) {
                return ServiceResponseDirector.errorBadRequest("documentId is required.");
            }

            Set<DispatchTemplateDocEntity> docs = template.getDocuments();
            if (docs == null) {
                docs = new LinkedHashSet<>();
                template.setDocuments(docs);
            }

            DispatchTemplateDocEntity doc = docs.stream()
                    .filter(d -> Objects.equals(d.getDocumentId(), documentId))
                    .findFirst()
                    .orElse(null);

            Long excludeDocId = (doc != null) ? doc.getId() : null;

            if (templateRepo.existsDocWithDocumentId(templateId, documentId, excludeDocId)) {
                return ServiceResponseDirector.errorBadRequest(
                        "Template already contains documentId=" + documentId + "."
                );
            }

            if (doc == null) {
                doc = new DispatchTemplateDocEntity();
                doc.setTemplate(template);
                doc.setDocumentId(documentId);
                doc.setItems(new LinkedHashSet<>());
                docs.add(doc);
            }

            if (req.getSortOrder() != null) {
                doc.setSortOrder(req.getSortOrder());
            }
            if (req.getDraft() != null) {
                doc.setDraft(req.getDraft());
            }
            doc.setDefaultNote(req.getDefaultNote());

            DispatchTemplateEntity fullTemplate = templateRepo.findFull(templateId, userId);
            return ServiceResponseDirector.successOk(templateMapper.toDto(fullTemplate), "Template document saved.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to save template document.");
        }
    }

    @Transactional
    public ServiceResponseDTO<TemplateResponseDTO> moveTemplate(Long templateId, TemplateMoveRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity template = templateRepo.findFull(templateId, userId);
            if (template == null) {
                return ServiceResponseDirector.errorNotFound("Template not found.");
            }

            if (template.getOwner() == null || !Objects.equals(template.getOwner().getId(), userId)) {
                return ServiceResponseDirector.errorBadRequest("Only owner can move template.");
            }

            Long targetFolderId = (req != null) ? req.getTargetFolderId() : null;
            DispatchTemplateFolderEntity targetFolder =
                    (targetFolderId == null) ? null : folderRepo.findOwned(targetFolderId, userId);

            if (targetFolderId != null && targetFolder == null) {
                return ServiceResponseDirector.errorBadRequest("Folder not found.");
            }

            template.setFolder(targetFolder);

            if (template.getName() != null) {
                template.setName(
                        templateNamingService.makeUniqueTemplateNameForFolder(
                                userId,
                                targetFolder,
                                template.getName(),
                                template.getId()
                        )
                );
            }

            DispatchTemplateEntity fullTemplate = templateRepo.findFull(templateId, userId);
            return ServiceResponseDirector.successOk(templateMapper.toDto(fullTemplate), "Template moved.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to move template.");
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

            if (templateRepo.isNotOwnedBy(templateId, userId)) {
                return ServiceResponseDirector.errorNotFound("Template not found.");
            }

            if (!templateRepo.existsOwnedDoc(templateId, templateDocId, userId)) {
                return ServiceResponseDirector.errorBadRequest("Template document not found.");
            }

            Map<Long, BigDecimal> qtyByItemId = normalizeItems(items);
            if (qtyByItemId.isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("Document must contain at least one valid item.");
            }

            docItemRepo.replaceAllForDoc(templateDocId, qtyByItemId);

            DispatchTemplateEntity fullTemplate = templateRepo.findFull(templateId, userId);
            return ServiceResponseDirector.successOk(templateMapper.toDto(fullTemplate), "Template items replaced.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to replace template items.");
        }
    }

    private Map<Long, DispatchTemplateSharePermission> loadSharedPermissions(
            Long userId,
            Set<Long> onlyTemplateIds
    ) {
        if (onlyTemplateIds == null || onlyTemplateIds.isEmpty()) {
            return Map.of();
        }

        return dispatchTemplateShareRepo
                .listForSharedWithAndTemplateIds(userId, onlyTemplateIds)
                .stream()
                .filter(s -> s.getTemplate() != null && s.getTemplate().getId() != null)
                .collect(Collectors.toMap(
                        s -> s.getTemplate().getId(),
                        DispatchTemplateShareEntity::getPermission,
                        (a, b) ->
                                (a == DispatchTemplateSharePermission.BOOK || b == DispatchTemplateSharePermission.BOOK)
                                        ? DispatchTemplateSharePermission.BOOK
                                        : DispatchTemplateSharePermission.VIEW
                ));
    }

    private List<DispatchTemplateEntity> mergeAndSortTemplates(
            List<DispatchTemplateEntity> owned,
            List<DispatchTemplateEntity> shared
    ) {
        List<DispatchTemplateEntity> all = new ArrayList<>(owned.size() + shared.size());
        all.addAll(owned);
        all.addAll(shared);

        all.sort(Comparator
                .comparing(DispatchTemplateEntity::getHouseholdSize, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(t -> t.getName() == null ? "" : t.getName().toLowerCase())
                .thenComparing(DispatchTemplateEntity::getId, Comparator.nullsLast(Comparator.reverseOrder())));

        return all;
    }

    private List<TemplateResponseDTO> mapTemplateHeaders(
            List<DispatchTemplateEntity> templates,
            Set<Long> sharedIds,
            Map<Long, DispatchTemplateSharePermission> permissionByTemplateId
    ) {
        return templates.stream()
                .map(t -> {
                    TemplateResponseDTO out = templateMapper.toDto(t);

                    boolean isShared = sharedIds.contains(t.getId());
                    out.setShared(isShared);
                    out.setSharedPermission(isShared ? permissionByTemplateId.get(t.getId()) : null);

                    return out;
                })
                .toList();
    }

    private DispatchTemplateEntity createTemplateCopyShell(
            DispatchTemplateEntity source,
            TemplateCopyRequestDTO req,
            UserEntity owner,
            DispatchTemplateFolderEntity targetFolder,
            Long userId
    ) {
        String sourceName = (source.getName() == null || source.getName().isBlank()) ? "Template" : source.getName();
        String desiredName = (req != null && req.getNewName() != null && !req.getNewName().isBlank())
                ? req.getNewName().trim()
                : sourceName + " - Copy";

        DispatchTemplateEntity copy = new DispatchTemplateEntity();
        copy.setOwner(owner);
        copy.setFolder(targetFolder);
        copy.setHouseholdSize(source.getHouseholdSize());
        copy.setName(templateNamingService.makeUniqueTemplateNameForFolder(userId, targetFolder, desiredName));
        copy.setDescription(source.getDescription());
        copy.setDocuments(new LinkedHashSet<>());
        copy.persist();

        return copy;
    }

    private void copyTemplateDocuments(DispatchTemplateEntity source, DispatchTemplateEntity copy) {
        if (source.getDocuments() == null || source.getDocuments().isEmpty()) {
            return;
        }

        for (DispatchTemplateDocEntity sourceDoc : source.getDocuments()) {
            DispatchTemplateDocEntity copyDoc = new DispatchTemplateDocEntity();
            copyDoc.setTemplate(copy);
            copyDoc.setSortOrder(sourceDoc.getSortOrder());
            copyDoc.setDocumentId(sourceDoc.getDocumentId());
            copyDoc.setDraft(sourceDoc.getDraft());
            copyDoc.setDefaultNote(sourceDoc.getDefaultNote());
            copyDoc.setItems(new LinkedHashSet<>());
            copyDoc.persist();

            if (sourceDoc.getItems() != null) {
                for (DispatchTemplateDocItemEntity sourceItem : sourceDoc.getItems()) {
                    DispatchTemplateDocItemEntity copyItem = new DispatchTemplateDocItemEntity();
                    copyItem.setTemplateDoc(copyDoc);
                    copyItem.setSortOrder(sourceItem.getSortOrder());
                    copyItem.setItemId(sourceItem.getItemId());
                    copyItem.setQuantity(sourceItem.getQuantity());
                    copyItem.persist();

                    copyDoc.getItems().add(copyItem);
                }
            }

            copy.getDocuments().add(copyDoc);
        }
    }

    private Map<Long, BigDecimal> normalizeItems(List<TemplateItemUpsertRequestDTO> items) {
        Map<Long, BigDecimal> qtyByItemId = new LinkedHashMap<>();

        if (items == null) {
            return qtyByItemId;
        }

        for (TemplateItemUpsertRequestDTO item : items) {
            if (item == null || item.getItemId() == null) continue;
            if (item.getQuantity() == null || item.getQuantity().signum() <= 0) continue;

            qtyByItemId.merge(item.getItemId(), item.getQuantity(), BigDecimal::add);
        }

        return qtyByItemId;
    }

    private TemplateResponseDTO toTemplateDtoWithItemMeta(DispatchTemplateEntity template) {
        TemplateResponseDTO dto = templateMapper.toDto(template);
        enrichTemplateItemsWithOracleMeta(dto);
        return dto;
    }

    private void enrichTemplateItemsWithOracleMeta(TemplateResponseDTO dto) {
        if (dto == null || dto.getDocuments() == null || dto.getDocuments().isEmpty()) {
            return;
        }

        List<Long> itemIds = dto.getDocuments().stream()
                .filter(Objects::nonNull)
                .map(TemplateDocResponseDTO::getItems)
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .filter(Objects::nonNull)
                .map(TemplateItemResponseDTO::getItemId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (itemIds.isEmpty()) {
            return;
        }

        Map<Long, ItemDescriptorResponseDTO> metaByItemId = itemDirectoryService.findItemsByIds(itemIds);
        if (metaByItemId.isEmpty()) {
            return;
        }

        for (TemplateDocResponseDTO doc : dto.getDocuments()) {
            if (doc == null || doc.getItems() == null) continue;

            for (TemplateItemResponseDTO item : doc.getItems()) {
                if (item == null || item.getItemId() == null) continue;

                ItemDescriptorResponseDTO meta = metaByItemId.get(item.getItemId());
                if (meta == null) continue;

                item.setItemName(meta.getName());
                item.setItemCode(meta.getCode());
                item.setUnit(meta.getUnit());
                item.setBarcode(meta.getBarcode());
            }
        }
    }
}
