import React from "react";
import { RefreshControl, ScrollView, ScrollViewProps } from "react-native";
import Screen from "./Screen";
import Colors from "@/constants/Colors";

type Props = ScrollViewProps & {
    refreshing?: boolean;
    onRefresh?: () => void;
    tintColor?: string;
    withScreen?: boolean;
    progressBackgroundColor?: string;
};

export default function TabScroll({
    refreshing,
    onRefresh,
    tintColor = Colors.orange,
    progressBackgroundColor = Colors.light.background,
    withScreen = true,
    children,
    contentContainerStyle,
    ...rest
}: Props) {
    const scroll = (
        <ScrollView
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
}
