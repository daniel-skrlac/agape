import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutAnimation } from "react-native";

type Opts = {
    warehouses: number[];
    defaultWarehouseId: number | null;
    enableFollowsDefault?: boolean;
};

export function useWarehousePicker(opts: Opts) {
    const { warehouses, defaultWarehouseId, enableFollowsDefault = true } = opts;

    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const followsDefaultRef = useRef(true);

    const reset = useCallback(() => {
        followsDefaultRef.current = true;
        setOpen(false);
        setSelectedId(null);
    }, []);

    const toggleOpen = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpen((p) => !p);
    }, []);

    const onSelect = useCallback(
        (id: number) => {
            if (enableFollowsDefault) followsDefaultRef.current = false;
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setSelectedId(id);
            setOpen(false);
        },
        [enableFollowsDefault]
    );

    useEffect(() => {
        if (!enableFollowsDefault) return;
        if (!followsDefaultRef.current) return;
        setSelectedId(null);
    }, [defaultWarehouseId, enableFollowsDefault]);

    useEffect(() => {
        if (!warehouses.length) return;

        if (enableFollowsDefault && !followsDefaultRef.current && selectedId != null) return;
        if (!enableFollowsDefault && selectedId != null) return;

        const next =
            defaultWarehouseId != null && warehouses.includes(defaultWarehouseId) ? defaultWarehouseId : warehouses[0];

        if (selectedId !== next) setSelectedId(next);
    }, [warehouses, defaultWarehouseId, selectedId, enableFollowsDefault]);

    return useMemo(
        () => ({
            open,
            setOpen,
            toggleOpen,
            selectedId,
            setSelectedId,
            onSelect,
            reset,
            isEmpty: warehouses.length === 0,
        }),
        [open, toggleOpen, selectedId, onSelect, reset, warehouses.length]
    );
}
