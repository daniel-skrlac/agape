package hr.agape.template.service;

import hr.agape.template.domain.DispatchTemplateFolderEntity;
import hr.agape.template.repository.DispatchTemplateFolderRepository;
import hr.agape.template.repository.DispatchTemplateRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class TemplateNamingService {

    private final DispatchTemplateFolderRepository folderRepo;
    private final DispatchTemplateRepository templateRepo;

    @Inject
    public TemplateNamingService(DispatchTemplateFolderRepository folderRepo,
                                 DispatchTemplateRepository templateRepo) {
        this.folderRepo = folderRepo;
        this.templateRepo = templateRepo;
    }

    public String makeUniqueFolderName(Long ownerUserId, DispatchTemplateFolderEntity parent, String desired) {
        return makeUniqueFolderName(ownerUserId, parent, desired, null);
    }

    public String makeUniqueFolderName(Long ownerUserId,
                                       DispatchTemplateFolderEntity parent,
                                       String desired,
                                       Long excludeFolderId) {
        Long parentId = parent == null ? null : parent.getId();
        List<String> siblingNames = folderRepo.listChildNamesExcluding(ownerUserId, parentId, excludeFolderId);
        return makeUnique(desired, siblingNames);
    }

    public String makeUniqueTemplateNameForFolder(Long ownerUserId, DispatchTemplateFolderEntity folder, String desired) {
        return makeUniqueTemplateNameForFolder(ownerUserId, folder, desired, null);
    }

    public String makeUniqueTemplateNameForFolder(Long ownerUserId, DispatchTemplateFolderEntity folder, String desired, Long excludeTemplateId) {
        Long folderId = folder == null ? null : folder.getId();
        List<String> existingNames = templateRepo.listNamesForOwnerAndFolder(ownerUserId, folderId, excludeTemplateId);
        return makeUnique(desired, existingNames);
    }

    public static String makeUnique(String base, List<String> existing) {
        String normalizedBase = base == null ? "" : base.trim();
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
}