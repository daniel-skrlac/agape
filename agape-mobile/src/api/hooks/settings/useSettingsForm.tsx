import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Strings from "@/src/constants/Strings";
import { updateSession } from "../../../../src/api/sessionStore";
import { userService } from "../../../../src/api/services/profile/userService";
import { toUserMessage } from "../../../../src/api/apiClient";

export type SubmitResult = { ok: true } | { ok: false };

export function useMainWarehouseSettingsForm(opts: {
    userId: number | null;
    savedWarehouseId: number | null;
}) {
    const savedRef = useRef<number | null>(opts.savedWarehouseId ?? null);

    const [warehouseId, setWarehouseIdState] = useState<number | null>(opts.savedWarehouseId ?? null);
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
        const nextSaved = opts.savedWarehouseId ?? null;
        savedRef.current = nextSaved;
        setWarehouseIdState(nextSaved);
        setTouched(false);
        clearStatus();
    }, [opts.userId]);

    useEffect(() => {
        const nextSaved = opts.savedWarehouseId ?? null;

        savedRef.current = nextSaved;

        if (submitting) return;
        if (touched) return;

        setWarehouseIdState((prev) => (prev === nextSaved ? prev : nextSaved));

        setFormError(null);
        setWarehouseError(null);
    }, [opts.savedWarehouseId, submitting, touched]);

    const syncToSaved = useCallback(
        (saved: number | null) => {
            savedRef.current = saved ?? null;
            setWarehouseIdState(saved ?? null);
            setTouched(false);
            clearStatus();
        },
        [clearStatus]
    );

    const resetToSaved = useCallback(
        (saved: number | null) => {
            savedRef.current = saved ?? null;
            setWarehouseIdState(saved ?? null);
            setTouched(false);
            clearStatus();
        },
        [clearStatus]
    );

    const setWarehouseId = useCallback((id: number | null) => {
        setWarehouseIdState(id);
        setTouched(true);
        setWarehouseError(null);
        setSuccessMessage(null);
        setFormError(null);
    }, []);

    const dirty = useMemo(() => {
        if (!touched) return false;
        return warehouseId !== (savedRef.current ?? null);
    }, [touched, warehouseId]);

    const canSubmit = useMemo(() => {
        if (!opts.userId) return false;
        if (submitting) return false;
        if (!dirty) return false;
        if (warehouseId == null) return false;
        return true;
    }, [opts.userId, submitting, dirty, warehouseId]);

    const submit = useCallback(async (): Promise<SubmitResult> => {
        clearStatus();

        if (!opts.userId) return { ok: false };

        if (warehouseId == null) {
            setWarehouseError(Strings.settings.mainWarehouse.validationRequired);
            return { ok: false };
        }

        if (!dirty) return { ok: false };

        try {
            setSubmitting(true);

            await userService.update(opts.userId, { defaultWarehouseId: warehouseId } as any);
            await updateSession({ defaultWarehouseId: warehouseId });

            savedRef.current = warehouseId;
            setTouched(false);

            setSuccessMessage(Strings.settings.mainWarehouse.saved);
            return { ok: true };
        } catch (e) {
            setFormError(toUserMessage(e));
            return { ok: false };
        } finally {
            setSubmitting(false);
        }
    }, [clearStatus, opts.userId, warehouseId, dirty]);

    return {
        values: { warehouseId },
        setWarehouseId,

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
