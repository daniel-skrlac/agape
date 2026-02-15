import React from "react";
import { Pressable, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Colors from "@/constants/Colors";
import { styles as s } from "./styles/ErrorCard.styles";

type Props = {
  title?: string;
  message: string;

  // primary action (npr. Retry ili Close)
  primaryText?: string;
  onPrimary?: () => void;

  // optional secondary action (npr. Close)
  secondaryText?: string;
  onSecondary?: () => void;

  disabled?: boolean;
  iconName?: React.ComponentProps<typeof FontAwesome>["name"];
};

export function ErrorCard({
  title = "Došlo je do greške",
  message,
  primaryText = "Zatvori",
  onPrimary,
  secondaryText,
  onSecondary,
  disabled,
  iconName = "exclamation-triangle",
}: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <FontAwesome name={iconName} size={16} color={Colors.dangerText} />
        <Text style={s.title}>{title}</Text>
      </View>

      <Text style={s.message}>{message}</Text>

      <View style={s.actions}>
        {!!secondaryText && !!onSecondary && (
          <Pressable
            style={[s.secondaryBtn, disabled && s.btnDisabled]}
            onPress={disabled ? undefined : onSecondary}
            disabled={disabled}
          >
            <Text style={s.secondaryText}>{secondaryText}</Text>
          </Pressable>
        )}

        {!!onPrimary && (
          <Pressable
            style={[s.primaryBtn, disabled && s.btnDisabled]}
            onPress={disabled ? undefined : onPrimary}
            disabled={disabled}
          >
            <Text style={s.primaryText}>{primaryText}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
