import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Strings from "@/src/constants/Strings";
import { updateSession } from "../../../../src/api/sessionStore";
import { userService } from "../../../../src/api/services/profile/userService";
import { toUserMessage } from "../../../../src/api/apiClient";

export type SubmitResult = { ok: true } | { ok: false };

export function useMainWarehouseSettingsForm(opts: {
    userId: number | null;
    savedWarehouseByStorageGroup?: Record<string, number> | null;
}) {
    const savedByGroupRef = useRef<Record<string, number>>(normalizeDefaults(opts.savedWarehouseByStorageGroup));

    const [warehouseByStorageGroup, setWarehouseByStorageGroupState] = useState<Record<string, number>>(
        normalizeDefaults(opts.savedWarehouseByStorageGroup)
    );
    const [touched, setTouched] = useState(false);

    const [submitting, setSubmitting] = useState(false);

    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [warehouseError, setWarehouseError] = useState<string | null>(null);

    const clearStatus = useCallback(() => {
        setSuccessMessage(null);
        setFormError(null);
        setWarehouseError(null);
    }, []);

    useEffect(() => {
        const nextByGroup = normalizeDefaults(opts.savedWarehouseByStorageGroup);
        savedByGroupRef.current = nextByGroup;
        setWarehouseByStorageGroupState(nextByGroup);
        setTouched(false);
        clearStatus();
    }, [opts.userId]);

    useEffect(() => {
        const nextByGroup = normalizeDefaults(opts.savedWarehouseByStorageGroup);

        savedByGroupRef.current = nextByGroup;

        if (submitting) return;
        if (touched) return;

        setWarehouseByStorageGroupState((prev) => (sameDefaults(prev, nextByGroup) ? prev : nextByGroup));

        setFormError(null);
        setWarehouseError(null);
    }, [opts.savedWarehouseByStorageGroup, submitting, touched]);

    const syncToSaved = useCallback(
        (savedByGroup?: Record<string, number> | null) => {
            const nextByGroup = normalizeDefaults(savedByGroup);
            savedByGroupRef.current = nextByGroup;
            setWarehouseByStorageGroupState(nextByGroup);
            setTouched(false);
            clearStatus();
        },
        [clearStatus]
    );

    const resetToSaved = useCallback(
        (savedByGroup?: Record<string, number> | null) => {
            const nextByGroup = normalizeDefaults(savedByGroup);
            savedByGroupRef.current = nextByGroup;
            setWarehouseByStorageGroupState(nextByGroup);
            setTouched(false);
            clearStatus();
        },
        [clearStatus]
    );

    const setWarehouseForStorageGroup = useCallback((storageGroupId: number | string, id: number | null) => {
        const key = String(storageGroupId);
        setWarehouseByStorageGroupState((prev) => {
            const next = { ...prev };
            if (id == null) delete next[key];
            else next[key] = id;
            return next;
        });
        setTouched(true);
        setWarehouseError(null);
        setSuccessMessage(null);
        setFormError(null);
    }, []);

    const dirty = useMemo(() => {
        if (!touched) return false;
        return !sameDefaults(warehouseByStorageGroup, savedByGroupRef.current);
    }, [touched, warehouseByStorageGroup]);

    const canSubmit = useMemo(() => {
        if (!opts.userId) return false;
        if (submitting) return false;
        if (!dirty) return false;
        return true;
    }, [opts.userId, submitting, dirty]);

    const submit = useCallback(async (): Promise<SubmitResult> => {
        clearStatus();

        if (!opts.userId) return { ok: false };

        if (!dirty) return { ok: false };

        try {
            setSubmitting(true);

            await userService.update(opts.userId, {
                defaultWarehouseByStorageGroup: warehouseByStorageGroup,
            } as any);
            await updateSession({
                defaultWarehouseByStorageGroup: warehouseByStorageGroup,
            });

            savedByGroupRef.current = { ...warehouseByStorageGroup };
            setTouched(false);

            setSuccessMessage(Strings.settings.mainWarehouse.saved);
            return { ok: true };
        } catch (e) {
            setFormError(toUserMessage(e));
            return { ok: false };
        } finally {
            setSubmitting(false);
        }
    }, [clearStatus, opts.userId, warehouseByStorageGroup, dirty]);

    return {
        values: { warehouseByStorageGroup },
        setWarehouseForStorageGroup,

        submitting,
        dirty,
        canSubmit,

        successMessage,
        errors: { formError, warehouseError },

        clearStatus,
        syncToSaved,
        resetToSaved,
        submit,
    };
}

function normalizeDefaults(raw?: Record<string, number> | null): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw ?? {})) {
        const storageGroupId = String(key).trim();
        const warehouseId = Number(value);
        if (!storageGroupId || !Number.isFinite(warehouseId) || warehouseId <= 0) continue;
        out[storageGroupId] = warehouseId;
    }
    return out;
}

function sameDefaults(a?: Record<string, number> | null, b?: Record<string, number> | null): boolean {
    const aa = normalizeDefaults(a);
    const bb = normalizeDefaults(b);
    const ak = Object.keys(aa).sort();
    const bk = Object.keys(bb).sort();
    if (ak.length !== bk.length) return false;
    return ak.every((key, index) => key === bk[index] && aa[key] === bb[key]);
}
