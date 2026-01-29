package hr.agape.template.repository;

import hr.agape.template.domain.DispatchTemplateFolderEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class DispatchTemplateFolderRepository implements PanacheRepository<DispatchTemplateFolderEntity> {

    public boolean belongsToOwner(Long folderId, Long ownerUserId) {
        return count("id = ?1 AND owner.id = ?2", folderId, ownerUserId) > 0;
    }

    public List<DispatchTemplateFolderEntity> listForOwner(Long ownerUserId) {
        return find("owner.id = ?1 ORDER BY parent.id NULLS FIRST, LOWER(name) ASC", ownerUserId).list();
    }

    public DispatchTemplateFolderEntity findOwned(Long folderId, Long ownerUserId) {
        return find("id = ?1 AND owner.id = ?2", folderId, ownerUserId).firstResult();
    }

    public List<String> listChildNames(Long ownerUserId, Long parentId) {
        if (parentId == null) {
            return find("""
                    SELECT f.name
                    FROM DispatchTemplateFolderEntity f
                    WHERE f.owner.id = ?1 AND f.parent IS NULL
                    """, ownerUserId)
                    .project(String.class)
                    .list();
        }

        return find("""
                SELECT f.name
                FROM DispatchTemplateFolderEntity f
                WHERE f.owner.id = ?1 AND f.parent.id = ?2
                """, ownerUserId, parentId)
                .project(String.class)
                .list();
    }
}
