package hr.agape.template.repository;

import hr.agape.template.domain.DispatchTemplateFolderEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.util.List;

@ApplicationScoped
public class DispatchTemplateFolderRepository implements PanacheRepository<DispatchTemplateFolderEntity> {

    @PersistenceContext
    EntityManager em;

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
            return em.createQuery(
                            "select f.name from DispatchTemplateFolderEntity f " +
                                    "where f.owner.id = ?1 and f.parent is null",
                            String.class
                    )
                    .setParameter(1, ownerUserId)
                    .getResultList();
        }

        return em.createQuery(
                        "select f.name from DispatchTemplateFolderEntity f " +
                                "where f.owner.id = ?1 and f.parent.id = ?2",
                        String.class
                )
                .setParameter(1, ownerUserId)
                .setParameter(2, parentId)
                .getResultList();
    }

    public List<String> listChildNamesExcluding(Long ownerUserId, Long parentId, Long excludeFolderId) {
        if (excludeFolderId == null) return listChildNames(ownerUserId, parentId);

        if (parentId == null) {
            return em.createQuery(
                            "select f.name from DispatchTemplateFolderEntity f " +
                                    "where f.owner.id = ?1 and f.parent is null and f.id <> ?2",
                            String.class
                    )
                    .setParameter(1, ownerUserId)
                    .setParameter(2, excludeFolderId)
                    .getResultList();
        }

        return em.createQuery(
                        "select f.name from DispatchTemplateFolderEntity f " +
                                "where f.owner.id = ?1 and f.parent.id = ?2 and f.id <> ?3",
                        String.class
                )
                .setParameter(1, ownerUserId)
                .setParameter(2, parentId)
                .setParameter(3, excludeFolderId)
                .getResultList();
    }
}
