import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Strings from "../../src/constants/Strings";
import Colors from "../../src/constants/Colors";

const AuthHeader: React.FC = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>{Strings.appName}</Text>

      <View style={styles.bottomLine} />
    </View>
  );
};

const styles = StyleSheet.create({
  bottomLine: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 0,
    height: 2,
    borderRadius: 999,
    backgroundColor: Colors.tintColor,
    opacity: 0.35,
  },
  container: {
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 14,
  },

  logo: {
    width: 180,
    height: 180,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
  },
});

export default AuthHeader;
