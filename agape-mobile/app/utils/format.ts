export function formatIntHR(n?: number) {
    const value = typeof n === "number" && Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 0 }).format(value);
}

export function formatQtyHR(n?: number) {
    const value = typeof n === "number" && Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 2 }).format(value);
}

export function formatTimeHR(ms?: number) {
    if (!ms) return "—";
    const d = new Date(ms);
    return new Intl.DateTimeFormat("hr-HR", { hour: "2-digit", minute: "2-digit" }).format(d);
}
