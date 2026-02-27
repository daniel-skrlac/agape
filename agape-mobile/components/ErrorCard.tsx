import React from "react";
import { Pressable, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Colors from "@/src/constants/Colors";
import { styles as s } from "./styles/ErrorCard.styles";

type Props = {
  title?: string;
  message: string;

  actionText?: string;
  onAction?: () => void;

  disabled?: boolean;
  iconName?: React.ComponentProps<typeof FontAwesome>["name"];

  titleLines?: number;
  messageLines?: number;
};

export function ErrorCard({
  title,
  message,
  actionText = "Pokušaj ponovno",
  onAction,
  disabled,
  iconName = "exclamation-triangle",
  titleLines = 1,
  messageLines = 1,
}: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.icon}>
        <FontAwesome name={iconName} size={14} color={Colors.dangerText} />
      </View>

      <View style={s.textWrap}>
        {!!title && (
          <Text style={s.title} numberOfLines={titleLines}>
            {title}
          </Text>
        )}
        <Text style={s.message} numberOfLines={messageLines}>
          {message}
        </Text>
      </View>

      {!!onAction ? (
        <Pressable
          style={[s.btn, disabled && s.disabled]}
          onPress={disabled ? undefined : onAction}
          disabled={disabled}
          hitSlop={8}
        >
          <Text style={s.btnText}>{actionText}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
