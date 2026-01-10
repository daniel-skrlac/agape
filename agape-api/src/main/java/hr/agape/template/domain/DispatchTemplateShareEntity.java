package hr.agape.template.domain;

import hr.agape.template.enumeration.DispatchTemplateSharePermission;
import hr.agape.user.domain.UserEntity;
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
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "dispatch_template_share")
public class DispatchTemplateShareEntity extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    public DispatchTemplateEntity template;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "shared_with_user_id", nullable = false)
    public UserEntity sharedWith;

    @Enumerated(EnumType.STRING)
    @Column(name = "permission", nullable = false, length = 20)
    public DispatchTemplateSharePermission permission = DispatchTemplateSharePermission.BOOK;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt;
}
