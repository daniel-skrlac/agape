package hr.agape.document.ref.domain;

import hr.agape.document.domain.DocumentHeader;
import hr.agape.document.domain.DocumentLine;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One commercial document to insert (header + its lines).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingUnit {
    private DocumentHeader header;
    private List<DocumentLine> lines;
}
