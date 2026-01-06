import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "../../constants/Colors";

type Props = {
  children: React.ReactNode;
};

export default function AuthBackground({ children }: Props) {
  return (
    <View style={styles.root}>
      {}
      <LinearGradient
        colors={["#FFFFFF", "#FFF7ED", "#FFFFFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {}
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobMidLeft]} />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  blob: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: Colors.tintColor,
    opacity: 0.06,
  },
  blobTopRight: {
    top: -110,
    right: -120,
  },
  blobMidLeft: {
    top: "45%",
    left: -150,
    transform: [{ scale: 1.1 }],
    opacity: 0.04,
  },
});
