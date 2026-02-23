package hr.agape.template.repository;

import hr.agape.template.domain.DispatchBookingSessionEntity;
import hr.agape.template.enumeration.BookingSessionStatus;
import io.quarkus.hibernate.orm.panache.PanacheQuery;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Parameters;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.OffsetDateTime;
import java.util.List;

@ApplicationScoped
public class DispatchBookingSessionRepository implements PanacheRepository<DispatchBookingSessionEntity> {

    public DispatchBookingSessionEntity findOwned(Long id, Long ownerUserId) {
        return find("id = ?1 and owner.id = ?2", id, ownerUserId).firstResult();
    }

    public long countForOwnerFiltered(
            Long ownerUserId,
            BookingSessionStatus status,
            String q,
            OffsetDateTime createdFrom,
            OffsetDateTime createdToExclusive
    ) {
        QuerySpec spec = buildFilterWhere(ownerUserId, status, q, createdFrom, createdToExclusive);
        return count(spec.whereClause, spec.params);
    }

    public List<DispatchBookingSessionEntity> pageForOwnerFiltered(
            Long ownerUserId,
            BookingSessionStatus status,
            String q,
            OffsetDateTime createdFrom,
            OffsetDateTime createdToExclusive,
            int page,
            int size
    ) {
        QuerySpec spec = buildFilterWhere(ownerUserId, status, q, createdFrom, createdToExclusive);

        PanacheQuery<DispatchBookingSessionEntity> query = find(
                spec.whereClause + " order by createdAt desc, id desc",
                spec.params
        );

        return query.page(Page.of(page, size)).list();
    }

    private QuerySpec buildFilterWhere(
            Long ownerUserId,
            BookingSessionStatus status,
            String q,
            OffsetDateTime createdFrom,
            OffsetDateTime createdToExclusive
    ) {
        StringBuilder where = new StringBuilder("owner.id = :ownerId");
        Parameters params = Parameters.with("ownerId", ownerUserId);

        if (status != null) {
            where.append(" and status = :status");
            params.and("status", status);
        }

        if (q != null && !q.isBlank()) {
            String qTrim = q.trim();
            String qText = "%" + qTrim.toLowerCase() + "%";
            String qId = "%" + qTrim + "%";

            where.append(" and (")
                    .append(" lower(title) like :qText")
                    .append(" or lower(coalesce(note, '')) like :qText")
                    .append(" or cast(id as string) like :qId")
                    .append(" )");

            params.and("qText", qText);
            params.and("qId", qId);
        }

        if (createdFrom != null) {
            where.append(" and createdAt >= :createdFrom");
            params.and("createdFrom", createdFrom);
        }

        if (createdToExclusive != null) {
            where.append(" and createdAt < :createdToExclusive");
            params.and("createdToExclusive", createdToExclusive);
        }

        return new QuerySpec(where.toString(), params);
    }

    private record QuerySpec(String whereClause, Parameters params) {
    }
}