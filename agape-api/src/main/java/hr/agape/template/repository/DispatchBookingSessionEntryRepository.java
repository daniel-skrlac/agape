package hr.agape.template.repository;

import hr.agape.template.domain.DispatchBookingSessionEntryEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class DispatchBookingSessionEntryRepository implements PanacheRepository<DispatchBookingSessionEntryEntity> {

    public List<DispatchBookingSessionEntryEntity> listForSession(Long sessionId) {
        return find("bookingSession.id = ?1 order by id asc", sessionId).list();
    }

    public DispatchBookingSessionEntryEntity findBySessionAndPartner(Long sessionId, Long partnerId) {
        return find("bookingSession.id = ?1 and partnerId = ?2", sessionId, partnerId).firstResult();
    }
}
