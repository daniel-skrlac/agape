package hr.agape.template.repository;

import hr.agape.template.domain.DispatchTemplateDocEntity;
import hr.agape.template.domain.DispatchTemplateDocItemEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;

import java.math.BigDecimal;
import java.util.Map;

@ApplicationScoped
public class DispatchTemplateDocItemRepository implements PanacheRepository<DispatchTemplateDocItemEntity> {

    @Inject
    EntityManager em;

    public void deleteByTemplateDocId(Long templateDocId) {
        delete("templateDoc.id", templateDocId);
    }

    public void replaceAllForDoc(Long templateDocId, Map<Long, BigDecimal> qtyByItemId) {
        deleteByTemplateDocId(templateDocId);

        em.flush();
        em.clear();

        DispatchTemplateDocEntity docRef = em.getReference(DispatchTemplateDocEntity.class, templateDocId);

        int sort = 1;
        for (var e : qtyByItemId.entrySet()) {
            DispatchTemplateDocItemEntity ent = new DispatchTemplateDocItemEntity();
            ent.setTemplateDoc(docRef);
            ent.setItemId(e.getKey());
            ent.setQuantity(e.getValue());
            ent.setSortOrder(sort++);
            em.persist(ent);
        }

        em.flush();
    }
}
