package hr.agape.user.repository;

import hr.agape.user.domain.UserEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class UserRepository implements PanacheRepository<UserEntity> {

    public UserEntity findByUsername(String username) {
        return find("LOWER(username) = LOWER(?1)", username)
                .firstResult();
    }

    public boolean existsByUsername(String username) {
        return count("LOWER(username) = LOWER(?1)", username) > 0;
    }

    public boolean existsByUsernameExcludingId(String username, Long excludedUserId) {
        return count("LOWER(username) = LOWER(?1) AND id <> ?2", username, excludedUserId) > 0;
    }

    public long countDirectory(String q) {
        if (q == null || q.isBlank()) return count();

        String like = "%" + q.toLowerCase().trim() + "%";
        return count("""
                LOWER(username) LIKE ?1 OR LOWER(name) LIKE ?1
                """, like);
    }

    public List<UserEntity> pageDirectory(String q, int page, int size) {
        if (page < 0) page = 0;
        if (size < 1) size = 20;
        int offset = page * size;

        if (q == null || q.isBlank()) {
            return find("ORDER BY LOWER(username) ASC, id ASC")
                    .range(offset, offset + size - 1)
                    .list();
        }

        String like = "%" + q.toLowerCase().trim() + "%";
        return find("""
                (LOWER(username) LIKE ?1 OR LOWER(name) LIKE ?1)
                ORDER BY LOWER(username) ASC, id ASC
                """, like)
                .range(offset, offset + size - 1)
                .list();
    }
}
