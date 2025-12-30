import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { technicolorStripeColors, technicolorStripeLocations } from "../constants/colors";

interface TechnicolorButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const TechnicolorButton: React.FC<TechnicolorButtonProps> = ({
  label,
  onPress,
  icon,
  iconSize = 22,
  style,
  textStyle,
}) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={styles.shadowWrapper}>
        <LinearGradient
          colors={[...technicolorStripeColors]}
          locations={[...technicolorStripeLocations]}
          start={{ x: 0, y: -0.5 }}
          end={{ x: 0.7, y: 2.5 }}
          style={[styles.button, style]}
        >
          {icon && <Ionicons name={icon} size={iconSize} color="#FFFFFF" style={styles.icon} />}
          <Text style={[styles.label, textStyle]}>{label}</Text>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  shadowWrapper: {
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 60,
    borderWidth: 1,
    borderColor: "#000000",
    overflow: "hidden",
  },
  icon: {
    marginRight: 8,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: 2,
  },
});

export default TechnicolorButton;
