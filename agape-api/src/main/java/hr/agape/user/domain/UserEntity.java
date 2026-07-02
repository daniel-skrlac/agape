package hr.agape.user.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "app_user")
public class UserEntity extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "username", nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "oib", nullable = false, length = 11)
    private String oib;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "default_warehouse_by_storage_group", nullable = false, columnDefinition = "jsonb")
    private String defaultWarehouseByStorageGroupJson = "{}";

    @ManyToMany
    @JoinTable(
            name = "user_role",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<RoleEntity> roles;

    @PrePersist
    @PreUpdate
    void ensureJsonDefaults() {
        if (defaultWarehouseByStorageGroupJson == null || defaultWarehouseByStorageGroupJson.isBlank()) {
            defaultWarehouseByStorageGroupJson = "{}";
        }
    }
}
