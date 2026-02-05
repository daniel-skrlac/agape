package hr.agape.template.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(
        name = "dispatch_template_item",
        uniqueConstraints = {
                @UniqueConstraint(name = "ux_dt_template_item_unique", columnNames = {"template_id", "item_id"})
        }
)
@NoArgsConstructor
public class DispatchTemplateItemEntity extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private DispatchTemplateEntity template;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "item_id", nullable = false)
    private Long itemId;

    @Column(nullable = false, precision = 15, scale = 5)
    private BigDecimal quantity;
}
