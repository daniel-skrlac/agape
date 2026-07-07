import React, { forwardRef } from "react";
import { Platform, RefreshControl, ScrollView, ScrollViewProps } from "react-native";
import Screen from "./Screen";
import Colors from "@/src/constants/Colors";
import { useKeyboardInset } from "@/src/keyboard/KeyboardInsetProvider";

type Props = ScrollViewProps & {
    refreshing?: boolean;
    onRefresh?: () => void;
    tintColor?: string;
    withScreen?: boolean;
    progressBackgroundColor?: string;
};

const TabScroll = forwardRef<ScrollView, Props>(function TabScroll({
    refreshing,
    onRefresh,
    tintColor = Colors.orange,
    progressBackgroundColor = Colors.light.background,
    withScreen = true,
    children,
    contentContainerStyle,
    keyboardDismissMode,
    keyboardShouldPersistTaps,
    automaticallyAdjustKeyboardInsets,
    ...rest
}: Props, ref) {
    const keyboard = useKeyboardInset();
    const keyboardPadding = Platform.OS === "android" && keyboard.visible ? keyboard.bottom + 24 : 0;

    const scroll = (
        <ScrollView
            ref={ref}
            {...rest}
            keyboardDismissMode={keyboardDismissMode ?? (Platform.OS === "ios" ? "interactive" : "on-drag")}
            keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? "handled"}
            automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets ?? true}
            contentContainerStyle={[
                { flexGrow: 1 },
                contentContainerStyle,
                keyboardPadding > 0 ? { paddingBottom: keyboardPadding } : null,
            ]}
            refreshControl={
                refreshing != null && onRefresh ? (
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        progressViewOffset={10}
                        tintColor={tintColor}
                        colors={[tintColor]}
                        progressBackgroundColor={progressBackgroundColor}
                    />
                ) : undefined
            }
        >
            {children}
        </ScrollView>
    );

    if (!withScreen) return scroll;
    return <Screen>{scroll}</Screen>;
});

export default TabScroll;
