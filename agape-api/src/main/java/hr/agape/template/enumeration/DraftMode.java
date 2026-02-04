package hr.agape.template.enumeration;

public enum DraftMode {
    DRAFT,
    FINAL;

    public boolean asDraftFlag() {
        return this == DRAFT;
    }
}