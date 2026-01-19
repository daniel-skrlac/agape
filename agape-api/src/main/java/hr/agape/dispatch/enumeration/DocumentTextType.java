package hr.agape.dispatch.enumeration;

public enum DocumentTextType {
    OTPREMNICA("OTPREMNICA"),
    PRIMKA("PRIMKA"),
    KALKULACIJA("KALKULACIJA");

    private final String name;

    DocumentTextType(String name) {
        this.name = name;
    }

    public String dbValue() {
        return name;
    }

    public static DocumentTextType fromDbValue(String v) {
        if (v == null) return null;
        for (var t : values()) if (t.name.equalsIgnoreCase(v.trim())) return t;
        throw new IllegalArgumentException("Unknown DispatchHeaderTextType: " + v);
    }
}
