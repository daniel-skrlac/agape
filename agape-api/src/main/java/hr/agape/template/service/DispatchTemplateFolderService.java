package hr.agape.template.service;

import hr.agape.common.dto.BaseSearchFilter;
import hr.agape.common.dto.PagedResultDTO;
import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.template.domain.DispatchTemplateDocEntity;
import hr.agape.template.domain.DispatchTemplateDocItemEntity;
import hr.agape.template.domain.DispatchTemplateEntity;
import hr.agape.template.domain.DispatchTemplateFolderEntity;
import hr.agape.template.dto.FolderCopyRequestDTO;
import hr.agape.template.dto.FolderCreateRequestDTO;
import hr.agape.template.dto.FolderMoveRequestDTO;
import hr.agape.template.dto.FolderRenameRequestDTO;
import hr.agape.template.dto.FolderResponseDTO;
import hr.agape.template.dto.FolderSearchFilter;
import hr.agape.template.mapper.DispatchTemplateFolderMapper;
import hr.agape.template.repository.DispatchTemplateFolderRepository;
import hr.agape.template.repository.DispatchTemplateRepository;
import hr.agape.user.domain.UserEntity;
import hr.agape.user.repository.UserRepository;
import hr.agape.user.util.AuthUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@ApplicationScoped
public class DispatchTemplateFolderService {

    private final TemplateNamingService namingService;
    private final DispatchTemplateFolderRepository folderRepo;
    private final DispatchTemplateRepository templateRepo;

    private final UserRepository userRepo;

    private final DispatchTemplateFolderMapper folderMapper;

    private final AuthUtil authUtil;

    public DispatchTemplateFolderService(TemplateNamingService namingService, DispatchTemplateFolderRepository folderRepo,
                                         DispatchTemplateRepository templateRepo,
                                         UserRepository userRepo, DispatchTemplateFolderMapper folderMapper,
                                         AuthUtil authUtil) {
        this.namingService = namingService;
        this.folderRepo = folderRepo;
        this.templateRepo = templateRepo;
        this.userRepo = userRepo;
        this.folderMapper = folderMapper;
        this.authUtil = authUtil;
    }

    public ServiceResponseDTO<PagedResultDTO<FolderResponseDTO>> listFolders(Long parentId, BaseSearchFilter f) {
        try {
            Long userId = authUtil.requireUserId();

            if (parentId != null && folderRepo.doesNotBelongToOwner(parentId, userId)) {
                return ServiceResponseDirector.errorBadRequest("Parent folder not found.");
            }

            int page = (f == null) ? 0 : f.getPage();
            int size = (f == null) ? 10 : f.getSize();

            long total = folderRepo.countChildren(userId, parentId);
            List<DispatchTemplateFolderEntity> list = folderRepo.pageChildren(userId, parentId, page, size);

            PagedResultDTO<FolderResponseDTO> result = PagedResultDTO.<FolderResponseDTO>builder()
                    .items(list.stream().map(folderMapper::toDto).toList())
                    .page(page)
                    .size(size)
                    .total(total)
                    .build();

            return ServiceResponseDirector.successOk(result, "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to list folders.");
        }
    }

    public ServiceResponseDTO<List<FolderResponseDTO>> listRootFolders(FolderSearchFilter f) {
        try {
            Long userId = authUtil.requireUserId();
            String q = normalizeQ(f);

            List<DispatchTemplateFolderEntity> list = folderRepo.listRootChildren(userId, q);

            return ServiceResponseDirector.successOk(
                    list.stream().map(folderMapper::toDto).toList(),
                    "OK"
            );
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to list root folders.");
        }
    }

    public ServiceResponseDTO<List<FolderResponseDTO>> listFolderTree() {
        try {
            Long userId = authUtil.requireUserId();

            List<DispatchTemplateFolderEntity> list = folderRepo.listTreeForOwner(userId);

            return ServiceResponseDirector.successOk(
                    list.stream().map(folderMapper::toDto).toList(),
                    "OK"
            );
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to list folder tree.");
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

            DispatchTemplateFolderEntity f = folderMapper.toEntity(req, owner, parent);

            f.setName(namingService.makeUniqueFolderName(userId, parent, req.getName()));

            f.persist();

            return ServiceResponseDirector.successOk(folderMapper.toDto(f), "Folder created.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to create folder.");
        }
    }

    @Transactional
    public ServiceResponseDTO<FolderResponseDTO> renameFolder(Long folderId, FolderRenameRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateFolderEntity f = folderRepo.findOwned(folderId, userId);
            if (f == null) return ServiceResponseDirector.errorNotFound("Folder not found.");

            String uniqueName = namingService.makeUniqueFolderName(
                    userId,
                    f.getParent(),
                    req.getName(),
                    f.getId()
            );

            f.setName(uniqueName);

            return ServiceResponseDirector.successOk(folderMapper.toDto(f), "Folder renamed.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to rename folder.");
        }
    }

    @Transactional
    public ServiceResponseDTO<FolderResponseDTO> moveFolder(Long folderId, FolderMoveRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateFolderEntity folder = folderRepo.findOwned(folderId, userId);
            if (folder == null) {
                return ServiceResponseDirector.errorNotFound("Folder not found.");
            }

            Long targetParentId = req == null ? null : req.getTargetParentId();
            DispatchTemplateFolderEntity targetParent = resolveMoveTargetParent(userId, folderId, targetParentId);

            applyUniqueFolderNameInDestination(userId, folder, targetParentId);

            folder.setParent(targetParent);

            return ServiceResponseDirector.successOk(folderMapper.toDto(folder), "Folder moved.");
        } catch (IllegalArgumentException e) {
            return ServiceResponseDirector.errorBadRequest(e.getMessage());
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to move folder.");
        }
    }

    @Transactional
    public ServiceResponseDTO<FolderResponseDTO> copyFolderTree(Long sourceFolderId, FolderCopyRequestDTO req) {
        try {
            Long userId = authUtil.requireUserId();

            DispatchTemplateFolderEntity sourceRoot = folderRepo.findOwned(sourceFolderId, userId);
            if (sourceRoot == null) {
                return ServiceResponseDirector.errorNotFound("Folder not found.");
            }

            DispatchTemplateFolderEntity targetParent = resolveCopyTargetParent(userId, req);
            if (req != null && req.getTargetParentId() != null && targetParent == null) {
                return ServiceResponseDirector.errorBadRequest("Target folder not found.");
            }

            boolean includeSubfolders = shouldIncludeSubfolders(req);
            boolean includeTemplates = shouldIncludeTemplates(req);

            UserEntity me = userRepo.findById(userId);
            if (me == null) {
                return ServiceResponseDirector.errorUnauthorized("Invalid user.");
            }

            DispatchTemplateFolderEntity copiedRoot = createFolderCopy(sourceRoot, me, targetParent, userId);

            Map<Long, List<DispatchTemplateFolderEntity>> childrenByParentId =
                    includeSubfolders ? buildChildrenByParentId(userId) : Map.of();

            Map<Long, DispatchTemplateFolderEntity> copiedFolderBySourceId = new HashMap<>();
            copiedFolderBySourceId.put(sourceRoot.getId(), copiedRoot);

            Deque<DispatchTemplateFolderEntity> stack = new ArrayDeque<>();
            stack.push(sourceRoot);

            while (!stack.isEmpty()) {
                DispatchTemplateFolderEntity currentSource = stack.pop();
                DispatchTemplateFolderEntity currentCopy = copiedFolderBySourceId.get(currentSource.getId());

                if (includeTemplates) {
                    copyTemplatesInFolder(currentSource.getId(), userId, me, currentCopy);
                }

                if (!includeSubfolders) {
                    continue;
                }

                List<DispatchTemplateFolderEntity> children =
                        childrenByParentId.getOrDefault(currentSource.getId(), List.of());

                for (DispatchTemplateFolderEntity childSource : children) {
                    DispatchTemplateFolderEntity childCopy = createFolderCopy(childSource, me, currentCopy, userId);

                    copiedFolderBySourceId.put(childSource.getId(), childCopy);
                    stack.push(childSource);
                }
            }

            return ServiceResponseDirector.successOk(folderMapper.toDto(copiedRoot), "Folder copied.");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to copy folder.");
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
            return ServiceResponseDirector.errorInternal("Failed to delete folder.");
        }
    }

    private DispatchTemplateFolderEntity resolveCopyTargetParent(Long userId, FolderCopyRequestDTO req) {
        if (req == null || req.getTargetParentId() == null) {
            return null;
        }
        return folderRepo.findOwned(req.getTargetParentId(), userId);
    }

    private boolean shouldIncludeSubfolders(FolderCopyRequestDTO req) {
        return req == null || req.getIncludeSubfolders() == null || req.getIncludeSubfolders();
    }

    private boolean shouldIncludeTemplates(FolderCopyRequestDTO req) {
        return req == null || req.getIncludeTemplates() == null || req.getIncludeTemplates();
    }

    private Map<Long, List<DispatchTemplateFolderEntity>> buildChildrenByParentId(Long userId) {
        return folderRepo.listForOwner(userId).stream()
                .filter(f -> f.getId() != null)
                .filter(f -> f.getParent() != null && f.getParent().getId() != null)
                .collect(Collectors.groupingBy(f -> f.getParent().getId()));
    }

    private DispatchTemplateFolderEntity createFolderCopy(
            DispatchTemplateFolderEntity source,
            UserEntity owner,
            DispatchTemplateFolderEntity parent,
            Long ownerUserId
    ) {
        DispatchTemplateFolderEntity copy = new DispatchTemplateFolderEntity();
        copy.setOwner(owner);
        copy.setParent(parent);
        copy.setName(namingService.makeUniqueFolderName(ownerUserId, parent, source.getName() + " - Copy"));
        copy.persist();
        return copy;
    }

    private void copyTemplatesInFolder(
            Long sourceFolderId,
            Long ownerUserId,
            UserEntity owner,
            DispatchTemplateFolderEntity destinationFolder
    ) {
        List<DispatchTemplateEntity> srcTemplates =
                templateRepo.listWithDocsByOwnerAndFolder(ownerUserId, sourceFolderId);

        if (srcTemplates.isEmpty()) return;

        List<Long> templateIds = srcTemplates.stream()
                .map(DispatchTemplateEntity::getId)
                .toList();

        templateRepo.loadDocItemsForTemplates(templateIds);

        for (DispatchTemplateEntity src : srcTemplates) {
            copyOwnedTemplateGraphIntoFolder(src, ownerUserId, owner, destinationFolder);
        }
    }

    private void copyOwnedTemplateGraphIntoFolder(
            DispatchTemplateEntity sourceTemplate,
            Long ownerUserId,
            UserEntity owner,
            DispatchTemplateFolderEntity destFolder
    ) {
        DispatchTemplateEntity copiedTemplate = new DispatchTemplateEntity();
        copiedTemplate.setOwner(owner);
        copiedTemplate.setFolder(destFolder);
        copiedTemplate.setHouseholdSize(sourceTemplate.getHouseholdSize());
        copiedTemplate.setName(
                namingService.makeUniqueTemplateNameForFolder(
                        ownerUserId,
                        destFolder,
                        sourceTemplate.getName() + " - Copy"
                )
        );
        copiedTemplate.setDescription(sourceTemplate.getDescription());
        copiedTemplate.persist();

        if (sourceTemplate.getDocuments() == null || sourceTemplate.getDocuments().isEmpty()) {
            return;
        }

        for (DispatchTemplateDocEntity sourceDoc : sourceTemplate.getDocuments()) {
            DispatchTemplateDocEntity copiedDoc = new DispatchTemplateDocEntity();
            copiedDoc.setTemplate(copiedTemplate);
            copiedDoc.setSortOrder(sourceDoc.getSortOrder());
            copiedDoc.setDocumentId(sourceDoc.getDocumentId());
            copiedDoc.setDraft(sourceDoc.getDraft());
            copiedDoc.setDefaultNote(sourceDoc.getDefaultNote());
            copiedDoc.persist();

            if (sourceDoc.getItems() != null && !sourceDoc.getItems().isEmpty()) {
                for (DispatchTemplateDocItemEntity sourceItem : sourceDoc.getItems()) {
                    DispatchTemplateDocItemEntity copiedItem = new DispatchTemplateDocItemEntity();
                    copiedItem.setTemplateDoc(copiedDoc);
                    copiedItem.setSortOrder(sourceItem.getSortOrder());
                    copiedItem.setItemId(sourceItem.getItemId());
                    copiedItem.setQuantity(sourceItem.getQuantity());
                    copiedItem.persist();
                    copiedDoc.getItems().add(copiedItem);
                }
            }

            copiedTemplate.getDocuments().add(copiedDoc);
        }
    }

    private DispatchTemplateFolderEntity resolveMoveTargetParent(Long userId, Long folderId, Long targetParentId) {
        if (targetParentId == null) {
            return null;
        }

        if (targetParentId.equals(folderId)) {
            throw new IllegalArgumentException("Cannot move a folder into itself.");
        }

        DispatchTemplateFolderEntity targetParent = folderRepo.findOwned(targetParentId, userId);
        if (targetParent == null) {
            throw new IllegalArgumentException("Target folder not found.");
        }

        ensureNoCycle(userId, folderId, targetParentId);

        return targetParent;
    }

    private void ensureNoCycle(Long userId, Long folderId, Long targetParentId) {
        Map<Long, Long> parentById = new HashMap<>();
        for (DispatchTemplateFolderEntity x : folderRepo.listForOwner(userId)) {
            if (x.getId() == null) continue;
            if (x.getParent() == null || x.getParent().getId() == null) continue;
            parentById.put(x.getId(), x.getParent().getId());
        }

        Long current = targetParentId;
        while (current != null) {
            if (current.equals(folderId)) {
                throw new IllegalArgumentException("Cannot move folder under its own child.");
            }
            current = parentById.get(current);
        }
    }

    private void applyUniqueFolderNameInDestination(Long userId, DispatchTemplateFolderEntity folder, Long targetParentId) {
        List<String> siblingNames = folderRepo.listChildNamesExcluding(userId, targetParentId, folder.getId());
        String uniqueName = TemplateNamingService.makeUnique(folder.getName(), siblingNames);

        if (!Objects.equals(uniqueName, folder.getName())) {
            folder.setName(uniqueName);
        }
    }

    private String normalizeQ(FolderSearchFilter f) {
        if (f == null || f.getQ() == null) return null;
        String q = f.getQ().trim();
        return q.isBlank() ? null : q;
    }
}
