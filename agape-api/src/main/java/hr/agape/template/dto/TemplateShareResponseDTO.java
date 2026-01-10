package hr.agape.template.dto;

import hr.agape.template.enumeration.DispatchTemplateSharePermission;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TemplateShareResponseDTO {
    private Long id;
    private Long templateId;

    private Long sharedWithUserId;
    private String sharedWithUsername;

    private DispatchTemplateSharePermission permission;
    private OffsetDateTime createdAt;
}