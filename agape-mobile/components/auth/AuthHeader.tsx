import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Strings from "../../constants/Strings";
import Colors from "../../constants/Colors";

const AuthHeader: React.FC = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>{Strings.appName}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
  },
});

export default AuthHeader;
