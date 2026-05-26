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
  messageLines?: number | null;
  actionPlacement?: "right" | "bottom";
  selectableMessage?: boolean;
};

export function ErrorCard({
  title,
  message,
  actionText = "Pokušaj ponovno",
  onAction,
  disabled,
  iconName = "exclamation-triangle",
  titleLines = 1,
  actionPlacement = "right",
  selectableMessage = true,
}: Props) {
  const shouldStack = actionPlacement === "bottom" || message.length > 72;
  const resolvedMessageLines = undefined;

  return (
    <View style={[s.wrap, shouldStack && s.wrapStack]}>
      <View style={[s.row, shouldStack && s.rowStack]}>
        <View style={s.icon}>
          <FontAwesome name={iconName} size={14} color={Colors.dangerText} />
        </View>

        <View style={s.textWrap}>
          {!!title && (
            <Text style={s.title} numberOfLines={titleLines}>
              {title}
            </Text>
          )}
          <Text style={s.message} numberOfLines={resolvedMessageLines} selectable={selectableMessage}>
            {message}
          </Text>
        </View>

        {!!onAction && !shouldStack ? (
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

      {!!onAction && shouldStack ? (
        <Pressable
          style={[s.btn, s.btnStack, disabled && s.disabled]}
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
