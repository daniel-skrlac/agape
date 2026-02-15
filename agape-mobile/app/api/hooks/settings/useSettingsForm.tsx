import { useCallback, useMemo, useState } from "react";
import Strings from "@/constants/Strings";
import { updateSession } from "@/app/api/sessionStore";
import { userService } from "@/app/api/services/profile/userService";
import { toUserMessage } from "@/app/api/apiClient";

export type SubmitResult = { ok: true } | { ok: false };

export function useMainWarehouseSettingsForm(opts: {
    userId: number | null;
    savedWarehouseId: number | null;
}) {
    const [warehouseId, setWarehouseIdState] = useState<number | null>(opts.savedWarehouseId ?? null);
    const [submitting, setSubmitting] = useState(false);

    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [warehouseError, setWarehouseError] = useState<string | null>(null);

    const clearStatus = useCallback(() => {
        setSuccessMessage(null);
        setFormError(null);
        setWarehouseError(null);
    }, []);

    const syncToSaved = useCallback(
        (saved: number | null) => {
            setWarehouseIdState(saved);
            clearStatus();
        },
        [clearStatus]
    );

    const resetToSaved = useCallback(
        (saved: number | null) => {
            setWarehouseIdState(saved);
            clearStatus();
        },
        [clearStatus]
    );

    const setWarehouseId = useCallback(
        (id: number | null) => {
            setWarehouseIdState(id);
            setWarehouseError(null);
            setSuccessMessage(null);
            setFormError(null);
        },
        []
    );

    const dirty = useMemo(() => warehouseId !== (opts.savedWarehouseId ?? null), [warehouseId, opts.savedWarehouseId]);

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

            setSuccessMessage(Strings.settings.mainWarehouse.saved);
            return { ok: true };
        } catch (e) {
            setFormError(
                toUserMessage(e)
            );
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
