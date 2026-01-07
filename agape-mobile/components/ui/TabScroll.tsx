import React from "react";
import { RefreshControl, ScrollView, ScrollViewProps } from "react-native";
import Screen from "./Screen";

type Props = ScrollViewProps & {
    refreshing: boolean;
    onRefresh: () => void;
    tintColor?: string;
};

export default function TabScroll({
    refreshing,
    onRefresh,
    tintColor = "#F97316",
    children,
    contentContainerStyle,
    ...rest
}: Props) {
    return (
        <Screen>
            <ScrollView
                {...rest}
                contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        progressViewOffset={10}
                        tintColor={tintColor}
                        colors={[tintColor]}
                        progressBackgroundColor="#FFFFFF"
                    />
                }
            >
                {children}
            </ScrollView>
        </Screen>
    );
}
