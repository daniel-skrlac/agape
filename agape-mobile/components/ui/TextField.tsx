import React, { useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import Colors from "../../src/constants/Colors";

interface TextFieldProps extends TextInputProps {
  label: string;
  right?: React.ReactNode;
}

const TextField: React.FC<TextFieldProps> = ({
  label,
  right,
  style,
  onFocus,
  onBlur,
  editable = true,
  ...props
}) => {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        onPress={() => {
          if (!editable) return;
          inputRef.current?.focus();
        }}
        style={[
          styles.inputWrap,
          focused && styles.inputFocused,
          !editable && { opacity: 0.7 },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, style]}
          placeholderTextColor={Colors.light.inputPlaceholder}
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />

        {!!right ? (
          <View style={styles.right} pointerEvents="box-none">
            {right}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 14 },

  label: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },

  inputWrap: {
    minHeight: 54,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
    borderColor: "rgba(0,0,0,0.10)",
    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    paddingVertical: 12,
  },

  right: {
    marginLeft: 10,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  inputFocused: {
    borderColor: Colors.tintColor,
    shadowColor: Colors.tintColor,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
});

export default TextField;
