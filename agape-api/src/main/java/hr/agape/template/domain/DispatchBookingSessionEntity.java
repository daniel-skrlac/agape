package hr.agape.template.domain;

import hr.agape.template.enumeration.BookingSessionStatus;
import hr.agape.user.domain.UserEntity;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "dispatch_booking_session")
public class DispatchBookingSessionEntity extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private UserEntity owner;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "warehouse_id", nullable = false)
    private Long warehouseId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingSessionStatus status = BookingSessionStatus.DRAFT;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "finalized_at")
    private OffsetDateTime finalizedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "final_result", columnDefinition = "jsonb")
    private String finalResultJson;

    @OneToMany(mappedBy = "bookingSession", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DispatchBookingSessionEntryEntity> entries;
}
