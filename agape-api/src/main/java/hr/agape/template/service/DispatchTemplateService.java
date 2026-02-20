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
import hr.agape.template.dto.TemplateBookDocPatchDTO;
import hr.agape.template.dto.TemplateBookItemDTO;
import hr.agape.template.dto.TemplateBookManyRequestDTO;
import hr.agape.template.dto.TemplateBookOneRequestDTO;
import hr.agape.template.dto.TemplateCopyRequestDTO;
import hr.agape.template.dto.TemplateCreateRequestDTO;
import hr.agape.template.dto.TemplateDocUpsertRequestDTO;
import hr.agape.template.dto.TemplateItemUpsertRequestDTO;
import hr.agape.template.dto.TemplateMoveRequestDTO;
import hr.agape.template.dto.TemplateResponseDTO;
import hr.agape.template.dto.TemplateUpdateRequestDTO;
import hr.agape.template.enumeration.DispatchTemplateSharePermission;
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
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import static hr.agape.common.util.DateTimeUtil.ZAGREB;

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

    @Inject
    public DispatchTemplateService(
            DispatchTemplateFolderRepository folderRepo,
            DispatchTemplateRepository templateRepo,
            DispatchTemplateShareRepository dispatchTemplateShareRepo, DispatchTemplateDocItemRepository docItemRepo,
            UserRepository userRepo,
            DispatchTemplateMapper templateMapper, TemplateNamingService templateNamingService,
            DispatchBookingService oracleBooking,
            AuthUtil authUtil
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
            boolean draft = req.getDraftMode().asDraftFlag();

            List<DispatchRequestDTO> bulk = buildRequestsForPartner(
                    req.getWarehouseId(),
                    req.getPartnerId(),
                    docDate,
                    draft,
                    req.getDocPatches(),
                    req.getExtraItems(),
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
            boolean draft = req.getDraftMode().asDraftFlag();

            List<DispatchRequestDTO> all = new ArrayList<>();
            for (Long partnerId : req.getPartnerIds()) {
                all.addAll(buildRequestsForPartner(
                        req.getWarehouseId(),
                        partnerId,
                        docDate,
                        draft,
                        req.getDocPatches(),
                        req.getExtraItems(),
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
                    : src.getName() + " - Copy";
            copy.setName(templateNamingService.makeUniqueTemplateNameForFolder(userId, folder, desired));

            copy.setDescription(src.getDescription());
            copy.setCreatedAt(now);
            copy.setUpdatedAt(now);
            copy.setDocuments(new LinkedHashSet<>());
            copy.persist();

            for (DispatchTemplateDocEntity d : src.getDocuments()) {
                DispatchTemplateDocEntity cd = new DispatchTemplateDocEntity();
                cd.setTemplate(copy);
                cd.setSortOrder(d.getSortOrder());
                cd.setDocumentId(d.getDocumentId());
                cd.setDraft(d.getDraft());
                cd.setDefaultNote(d.getDefaultNote());
                cd.setItems(new LinkedHashSet<>());
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


    @Transactional
    public ServiceResponseDTO<Void> deleteTemplateDoc(Long templateId, Long templateDocId) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFull(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            if (t.getDocuments() == null || t.getDocuments().isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("Template has no documents.");
            }

            DispatchTemplateDocEntity doc = null;
            for (DispatchTemplateDocEntity d : t.getDocuments()) {
                if (d.getId() != null && d.getId().equals(templateDocId)) {
                    doc = d;
                    break;
                }
            }

            if (doc == null) return ServiceResponseDirector.errorNotFound("Template document not found.");

            t.getDocuments().remove(doc);

            if (doc.getItems() != null) {
                for (DispatchTemplateDocItemEntity it : doc.getItems()) {
                    it.delete();
                }
                doc.getItems().clear();
            }

            doc.delete();
            t.setUpdatedAt(OffsetDateTime.now(ZAGREB));

            return ServiceResponseDirector.successOk(null, "Template document deleted.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to delete template document: " + e.getMessage());
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
            t.setName(templateNamingService.makeUniqueTemplateNameForFolder(userId, folder, req.getName().trim()));
            t.setDescription(req.getDescription());
            t.setCreatedAt(now);
            t.setUpdatedAt(now);
            t.setDocuments(new LinkedHashSet<>());
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
                t.setName(templateNamingService.makeUniqueTemplateNameForFolder(userId, t.getFolder(), req.getName().trim(), t.getId()));
            }
            if (req.getDescription() != null) t.setDescription(req.getDescription());
            if (req.getHouseholdSize() != null) t.setHouseholdSize(req.getHouseholdSize().shortValue());

            if (req.getFolderId() != null) {
                DispatchTemplateFolderEntity folder = folderRepo.findOwned(req.getFolderId(), userId);
                if (folder == null) return ServiceResponseDirector.errorBadRequest("Folder not found.");

                boolean changed = t.getFolder() == null || t.getFolder().getId() == null || !t.getFolder().getId().equals(folder.getId());

                t.setFolder(folder);

                if (changed && t.getName() != null) {
                    t.setName(templateNamingService.makeUniqueTemplateNameForFolder(userId, folder, t.getName(), t.getId()));
                }
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
        Long userId = authUtil.requireUserId();

        DispatchTemplateEntity t = templateRepo.findFull(templateId, userId);
        if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

        if (req.getDocumentId() == null) {
            return ServiceResponseDirector.errorBadRequest("documentId is required.");
        }

        if (t.getDocuments() == null) t.setDocuments(new LinkedHashSet<>());

        // Find existing doc by documentId (your current upsert logic)
        DispatchTemplateDocEntity doc = null;
        for (DispatchTemplateDocEntity d : t.getDocuments()) {
            if (d.getDocumentId() != null && d.getDocumentId().equals(req.getDocumentId())) {
                doc = d;
                break;
            }
        }

        // If you ever change API to upsert by docId, you can still use this check:
        Long excludeDocId = (doc == null ? null : doc.getId());

        // PRE-CHECK uniqueness: (template_id, document_id)
        boolean wouldViolate = templateRepo.existsDocWithDocumentId(templateId, req.getDocumentId(), excludeDocId);
        if (wouldViolate && doc == null) {
            // doc == null means "creating new one", and docId already exists => violation
            return ServiceResponseDirector.errorBadRequest(
                    "Template already contains documentId=" + req.getDocumentId() + "."
            );
        }

        // Create if missing
        if (doc == null) {
            doc = new DispatchTemplateDocEntity();
            doc.setTemplate(t);
            doc.setDocumentId(req.getDocumentId());
            doc.setItems(new LinkedHashSet<>());
            t.getDocuments().add(doc);
        }

        // Update fields
        if (req.getSortOrder() != null) doc.setSortOrder(req.getSortOrder());
        if (req.getDraft() != null) doc.setDraft(req.getDraft());
        doc.setDefaultNote(req.getDefaultNote());

        t.setUpdatedAt(OffsetDateTime.now(ZAGREB));

        DispatchTemplateEntity full = templateRepo.findFull(templateId, userId);
        return ServiceResponseDirector.successOk(templateMapper.toDto(full), "Template document saved.");
    }

    @Transactional
    public ServiceResponseDTO<TemplateResponseDTO> moveTemplate(Long templateId, TemplateMoveRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateEntity t = templateRepo.findFull(templateId, userId);
            if (t == null) return ServiceResponseDirector.errorNotFound("Template not found.");

            // Owner-only: shared user ne bi trebao reorganizirati tvoje foldere
            if (t.getOwner() == null || !Objects.equals(t.getOwner().getId(), userId)) {
                return ServiceResponseDirector.errorBadRequest("Only owner can move template.");
            }

            Long targetFolderId = (req == null ? null : req.getTargetFolderId());

            DispatchTemplateFolderEntity folder = null;
            if (targetFolderId != null) {
                folder = folderRepo.findOwned(targetFolderId, userId);
                if (folder == null) return ServiceResponseDirector.errorBadRequest("Folder not found.");
            }

            t.setFolder(folder);

            // Uniqueness u odredišnoj mapi, ali zadrži naziv
            if (t.getName() != null) {
                t.setName(templateNamingService.makeUniqueTemplateNameForFolder(userId, folder, t.getName(), t.getId()));
            }

            t.setUpdatedAt(OffsetDateTime.now(ZAGREB));

            DispatchTemplateEntity full = templateRepo.findFull(templateId, userId);
            return ServiceResponseDirector.successOk(templateMapper.toDto(full), "Template moved.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to move template: " + e.getMessage());
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

            if (!templateRepo.existsOwnedDoc(templateId, templateDocId, userId)) {
                return ServiceResponseDirector.errorBadRequest("Template document not found.");
            }

            Map<Long, BigDecimal> qtyByItemId = new LinkedHashMap<>();
            if (items != null) {
                for (TemplateItemUpsertRequestDTO it : items) {
                    if (it == null || it.getItemId() == null) continue;
                    if (it.getQuantity() == null || it.getQuantity().signum() <= 0) continue;
                    qtyByItemId.merge(it.getItemId(), it.getQuantity(), BigDecimal::add);
                }
            }

            if (qtyByItemId.isEmpty()) {
                return ServiceResponseDirector.errorBadRequest("Document must contain at least one valid item.");
            }

            docItemRepo.replaceAllForDoc(templateDocId, qtyByItemId);

            templateRepo.touchUpdatedAt(templateId, OffsetDateTime.now(ZAGREB));

            DispatchTemplateEntity full = templateRepo.findFull(templateId, userId);
            return ServiceResponseDirector.successOk(templateMapper.toDto(full), "Template items replaced.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to replace template items: " + e.getMessage());
        }
    }

    static List<DispatchRequestDTO> buildRequestsForPartner(
            Long warehouseId,
            Long partnerId,
            LocalDate docDate,
            boolean draft,
            List<TemplateBookDocPatchDTO> docPatches,
            List<TemplateBookItemDTO> extraItems,
            DispatchTemplateEntity t
    ) {
        List<DispatchRequestDTO> out = new ArrayList<>();

        Map<Long, TemplateBookDocPatchDTO> patchByDocId =
                (docPatches == null ? List.<TemplateBookDocPatchDTO>of() : docPatches)
                        .stream()
                        .filter(p -> p != null && p.getDocumentId() != null)
                        .collect(Collectors.toMap(TemplateBookDocPatchDTO::getDocumentId, x -> x, (a, b) -> b));

        // figure out FIRST doc for extraItems
        DispatchTemplateDocEntity firstDoc = t.getDocuments().stream()
                .sorted(Comparator
                        .comparing(DispatchTemplateDocEntity::getSortOrder, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(DispatchTemplateDocEntity::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .findFirst()
                .orElse(null);

        Long firstDocId = firstDoc == null ? null : firstDoc.getDocumentId();

        for (DispatchTemplateDocEntity d : t.getDocuments()) {
            if (d.getItems() == null || d.getItems().isEmpty()) {
                throw new IllegalArgumentException("Template document " + d.getDocumentId() + " has no items.");
            }

            TemplateBookDocPatchDTO patch = patchByDocId.get(d.getDocumentId());

            String note = null;
            if (patch != null && d.getDefaultNote() != null) {
                note = d.getDefaultNote();
            }

            Map<Long, BigDecimal> qty = new LinkedHashMap<>();
            for (DispatchTemplateDocItemEntity it : d.getItems()) {
                qty.put(it.getItemId(), it.getQuantity());
            }

            // ONLY supported operation: addItems
            if (patch != null && patch.getAddItems() != null) {
                for (TemplateBookItemDTO a : patch.getAddItems()) {
                    if (a == null || a.getItemId() == null) continue;
                    BigDecimal v = a.getQuantity();
                    if (v == null || v.signum() == 0) continue;
                    qty.merge(a.getItemId(), v, BigDecimal::add);
                }
            }

            // Apply extraItems ONLY to first doc
            if (firstDocId != null && Objects.equals(d.getDocumentId(), firstDocId) && extraItems != null) {
                for (TemplateBookItemDTO a : extraItems) {
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
            dr.setDraft(draft);
            dr.setNote(note);

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

        return out;
    }
}
