package agapi.document.ref.domain;

import lombok.*;

/**
 * <p>The legacy model uses a two-step registry:
 * <ol>
 *   <li>{@code SD_SIFREG} maps a warehouse-specific <b>document slot</b> ({@code DOKUMENT_ID})
 *       to a row in {@code SD_SIFREZ}.</li>
 *   <li>{@code SD_SIFREZ} describes the <b>logical document type</b> (e.g. {@code DOKUMENTID=OTPREMNICA},
 *       {@code NAZIVDOKUMENTA=IZDATNICA}) and behavior flags (in/out flow, stock change).</li>
 * </ol>
 *
 * <p>This DTO consolidates both so service can quickly validate a {@code DOKUMENT_ID} and
 * understand whether it represents an outgoing dispatch note that affects stock.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentTypeMapping {

    /**
     * Document slot used by the application and stored in {@code SD_GLAVA.DOKUMENT_ID}.
     * <p>Source: {@code SD_SIFREG.DOKUMENT_ID}</p>
     * <p>Example: {@code 3}, {@code 9}, {@code 23}, {@code 32} — each often corresponds to
     *            "OTPREMNICA" in a different warehouse.</p>
     */
    private Integer documentId;

    /**
     * Foreign key to the document type master.
     * <p>Source: {@code SD_SIFREZ.SD_SIFREZ_ID} (linked from {@code SD_SIFREG})</p>
     */
    private Integer sdSifrezId;

    /**
     * Logical code/name of the document type.
     * <p>Source: {@code SD_SIFREZ.DOKUMENTID}</p>
     * <p>Example: {@code "OTPREMNICA"}</p>
     */
    private String documentCode;

    /**
     * Human-friendly display name of the document type.
     * <p>Source: {@code SD_SIFREZ.NAZIVDOKUMENTA}</p>
     * <p>Example: {@code "IZDATNICA"}</p>
     */
    private String displayName;

    /**
     * Direction flag of the document type (in/out).
     * <p>Source: {@code SD_SIFREZ.ULAZIZLAZ}</p>
     * <ul>
     *   <li>{@code 1} = IN (goods increase stock)</li>
     *   <li>{@code 4} = OUT (goods decrease stock) — typical for OTPREMNICA</li>
     * </ul>
     */
    private Integer inOutFlag;

    /**
     * Whether posting this document type changes stock quantities.
     * <p>Source: {@code SD_SIFREZ.MIJENJAZALIHU}</p>
     * <ul>
     *   <li>{@code 1} = yes, affects stock</li>
     *   <li>{@code 0} = no, informational only</li>
     * </ul>
     */
    private Integer changesStock;
}
