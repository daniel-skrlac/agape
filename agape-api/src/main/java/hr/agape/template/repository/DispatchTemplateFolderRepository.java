package hr.agape.template.repository;

import hr.agape.template.domain.DispatchTemplateFolderEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class DispatchTemplateFolderRepository implements PanacheRepository<DispatchTemplateFolderEntity> {


    public List<DispatchTemplateFolderEntity> listForOwner(Long ownerUserId) {
        return find("owner.id = ?1", ownerUserId).list();
    }

    public DispatchTemplateFolderEntity findOwned(Long folderId, Long ownerUserId) {
        return find("id = ?1 and owner.id = ?2", folderId, ownerUserId).firstResult();
    }

    public boolean belongsToOwner(Long folderId, Long ownerUserId) {
        return count("id = ?1 and owner.id = ?2", folderId, ownerUserId) > 0;
    }

    public List<String> listChildNames(Long ownerUserId, Long parentId) {
        if (parentId == null) {
            return find("owner.id = ?1 and parent is null", ownerUserId)
                    .project(String.class)
                    .list();
        }

        return find("owner.id = ?1 and parent.id = ?2", ownerUserId, parentId)
                .project(String.class)
                .list();
    }

    public List<String> listChildNamesExcluding(Long ownerUserId, Long parentId, Long excludeFolderId) {
        if (excludeFolderId == null) return listChildNames(ownerUserId, parentId);

        if (parentId == null) {
            return find("owner.id = ?1 and parent is null and id <> ?2", ownerUserId, excludeFolderId)
                    .project(String.class)
                    .list();
        }

        return find("owner.id = ?1 and parent.id = ?2 and id <> ?3", ownerUserId, parentId, excludeFolderId)
                .project(String.class)
                .list();
    }
}
