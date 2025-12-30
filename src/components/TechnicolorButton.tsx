import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// Technicolor stripe colors (purple to yellow) - 8 colors from Figma
const STRIPE_COLORS = [
  "#5C2F70", "#5C2F70",  // Purple
  "#733483", "#733483",  // Purple-magenta
  "#893781", "#893781",  // Magenta
  "#A13B7A", "#A13B7A",  // Pink-magenta
  "#BA416E", "#BA416E",  // Pink-coral
  "#D24A5A", "#D24A5A",  // Coral-red
  "#E66141", "#E66141",  // Orange-red
  "#F7D75C", "#F7D75C",  // Yellow
] as const;

// Locations from Figma (exact percentages)
const STRIPE_LOCATIONS = [
  0, 0.12,      // Purple
  0.13, 0.24,   // Purple-magenta
  0.25, 0.36,   // Magenta
  0.37, 0.48,   // Pink-magenta
  0.49, 0.60,   // Pink-coral
  0.61, 0.72,   // Coral-red
  0.73, 0.84,   // Orange-red
  0.85, 0.97,   // Yellow
] as const;

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
      <LinearGradient
        colors={STRIPE_COLORS}
        locations={STRIPE_LOCATIONS}
        start={{ x: 0, y: -0.5 }}
        end={{ x: 1, y: 1.5 }}
        style={[styles.button, style]}
      >
        {icon && <Ionicons name={icon} size={iconSize} color="#FFFFFF" style={styles.icon} />}
        <Text style={[styles.label, textStyle]}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 60,
    borderWidth: 1,
    borderColor: "#000000",
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
