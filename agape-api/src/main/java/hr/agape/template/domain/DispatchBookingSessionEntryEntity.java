package hr.agape.template.domain;

import hr.agape.template.enumeration.DraftMode;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
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
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(
        name = "dispatch_booking_session_entry",
        uniqueConstraints = @UniqueConstraint(name = "ux_dbse_session_partner", columnNames = {"session_id", "partner_id"})
)
public class DispatchBookingSessionEntryEntity extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private DispatchBookingSessionEntity bookingSession;

    @Column(name = "partner_id", nullable = false)
    private Long partnerId;

    @Column(name = "template_id", nullable = false)
    private Long templateId;

    @Enumerated(EnumType.STRING)
    @Column(name = "draft_mode", nullable = false, length = 10)
    private DraftMode draftMode;

    @Column(name = "document_date")
    private LocalDate documentDate;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "doc_patches", nullable = false, columnDefinition = "jsonb")
    private String docPatchesJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "extra_items", nullable = false, columnDefinition = "jsonb")
    private String extraItemsJson;

    @Column(name = "note", columnDefinition = "text")
    private String note;
}
