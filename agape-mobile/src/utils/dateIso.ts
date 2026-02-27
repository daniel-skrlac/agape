/**
 * Left-pad a number to 2 digits (e.g. 3 -> "03").
 */
function pad2(n: number) {
    return String(n).padStart(2, "0");
}

/**
 * Using local noon avoids DST edge cases.
 */
export function todayLocalNoon(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

/**
 * Date -> "YYYY-MM-DD" (local)
 */
export function dateToIsoLocal(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * "YYYY-MM-DD" -> Date at local noon, or null if invalid
 */
export function isoToDateLocal(iso?: string | null): Date | null {
    if (!iso) return null;
    const s = String(iso).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

    const [y, m, d] = s.split("-").map((x) => Number(x));
    const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * "YYYY-MM-DD" -> "DD.MM.YYYY" (HR), or "" if invalid/empty
 */
export function fmtHrFromIso(iso?: string | null): string {
    if (!iso) return "";
    const s = String(iso).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
    const [y, m, d] = s.split("-");
    return `${d}.${m}.${y}`;
}

/**
 * Today (local noon) + N days -> ISO "YYYY-MM-DD"
 */
export function isoAddDaysFromToday(days: number): string {
    const d = todayLocalNoon();
    d.setDate(d.getDate() + days);
    return dateToIsoLocal(d);
}

/**
 * First day of this month (local noon) -> ISO "YYYY-MM-DD"
 */
export function monthStartIsoFromToday(): string {
    const d = todayLocalNoon();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
}

/**
 * Format a Date as local "YYYY-MM-DD".
 */
export function toLocalDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function fmtHrDateTime(x: unknown): string {
    if (!x) return "—";

    const d =
        x instanceof Date ? x :
            typeof x === "number" ? new Date(x) :
                new Date(String(x));

    if (Number.isNaN(d.getTime())) return "—";

    const dd = pad2(d.getDate());
    const mm = pad2(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());

    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}