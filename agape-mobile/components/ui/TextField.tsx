import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import Colors from "../../constants/Colors";

interface TextFieldProps extends TextInputProps {
  label: string;
}

const TextField: React.FC<TextFieldProps> = ({ label, style, onFocus, onBlur, ...props }) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          style,
        ]}
        placeholderTextColor={Colors.light.inputPlaceholder}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  input: {
    minHeight: 54,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
    borderColor: "rgba(0,0,0,0.10)",
    fontSize: 15,
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
