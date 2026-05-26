import React, { forwardRef } from "react";
import { RefreshControl, ScrollView, ScrollViewProps } from "react-native";
import Screen from "./Screen";
import Colors from "@/src/constants/Colors";

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
    ...rest
}: Props, ref) {
    const scroll = (
        <ScrollView
            ref={ref}
            {...rest}
            contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
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
