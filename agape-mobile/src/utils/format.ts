export function formatQtyHR(n?: number) {
    const value = typeof n === "number" && Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 2 }).format(value);
}

export function formatTimeHR(ms?: number) {
    if (!ms) return "—";
    const d = new Date(ms);
    return new Intl.DateTimeFormat("hr-HR", { hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatTimeWithSecondsHR(ms?: number) {
    if (!ms) return "—";
    const d = new Date(ms);
    return new Intl.DateTimeFormat("hr-HR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
}

export function toFiniteNumber(v: unknown): number | null {
    if (v == null) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
}

export function formatQtyHRNullable(v: unknown): string {
    const n = toFiniteNumber(v);
    return n == null ? "" : formatQtyHR(n);
}
