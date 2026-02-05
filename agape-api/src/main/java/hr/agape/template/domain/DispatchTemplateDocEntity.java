package hr.agape.template.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(
        name = "dispatch_template_doc",
        uniqueConstraints = {
                @UniqueConstraint(name = "ux_dt_doc_template_document", columnNames = {"template_id", "document_id"})
        }
)
@NoArgsConstructor
public class DispatchTemplateDocEntity extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private DispatchTemplateEntity template;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "draft", nullable = false)
    private Boolean draft = false;

    @Column(name = "default_note", columnDefinition = "text")
    private String defaultNote;

    @OneToMany(mappedBy = "templateDoc", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("sortOrder ASC, id ASC")
    private List<DispatchTemplateDocItemEntity> items;
}
