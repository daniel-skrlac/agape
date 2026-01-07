import { useCallback, useMemo, useState } from "react";
import Strings from "@/constants/Strings";
import { updateSession } from "@/app/api/sessionStore";
import { userService } from "@/app/api/services/userService";

export function useMainWarehouseSettings(opts: {
    userId: number | null;
    sessionDefaultWarehouseId: number | null;
}) {
    const [warehouseId, _setWarehouseId] = useState<number | null>(
        opts.sessionDefaultWarehouseId ?? null
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

    const syncToSaved = useCallback((savedDefaultWarehouseId: number | null) => {
        _setWarehouseId(savedDefaultWarehouseId);
        setTouched(false);
    }, []);

    const resetToSaved = useCallback(
        (savedDefaultWarehouseId: number | null) => {
            clearStatus();
            _setWarehouseId(savedDefaultWarehouseId);
            setTouched(false);
        },
        [clearStatus]
    );

    const setWarehouseId = useCallback(
        (id: number | null) => {
            _setWarehouseId(id);
            setTouched(true);
            clearStatus();
        },
        [clearStatus]
    );

    const canSubmit = useMemo(() => {
        if (!opts.userId) return false;
        if (submitting) return false;
        if (!touched) return false;
        if (warehouseId == null) return false;
        return true;
    }, [opts.userId, submitting, touched, warehouseId]);

    const submit = useCallback(async () => {
        clearStatus();

        if (!opts.userId) return { ok: false as const };

        if (warehouseId == null) {
            setWarehouseError(Strings.settings.mainWarehouse.validationRequired);
            return { ok: false as const };
        }

        try {
            setSubmitting(true);

            const payload: any = {
                defaultWarehouseId: warehouseId
            };

            await userService.update(opts.userId, payload);

            await updateSession({ defaultWarehouseId: warehouseId });

            setSuccessMessage(Strings.settings.mainWarehouse.saved);
            setTouched(false);

            return { ok: true as const };
        } catch (e: any) {
            setFormError(e?.message ?? Strings.settings.mainWarehouse.errorGeneric);
            return { ok: false as const };
        } finally {
            setSubmitting(false);
        }
    }, [clearStatus, opts.userId, warehouseId]);

    return {
        values: { warehouseId },
        setWarehouseId,

        touched,
        submitting,
        canSubmit,

        successMessage,
        errors: { formError, warehouseError },

        clearStatus,
        syncToSaved,
        resetToSaved,
        submit,
    };
}
