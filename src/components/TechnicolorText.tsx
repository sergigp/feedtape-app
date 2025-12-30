import React from 'react';
import { Text, TextStyle } from 'react-native';
import { technicolorGradient } from '../constants/colors';

/**
 * Converts hex color to RGB values
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

/**
 * Converts RGB values to hex color
 */
const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
};

/**
 * Interpolates between two colors
 * @param factor - 0 returns color1, 1 returns color2
 */
const interpolateColor = (color1: string, color2: string, factor: number): string => {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  const r = c1.r + (c2.r - c1.r) * factor;
  const g = c1.g + (c2.g - c1.g) * factor;
  const b = c1.b + (c2.b - c1.b) * factor;

  return rgbToHex(r, g, b);
};

/**
 * Gets the color at a specific position (0 to 1) along the gradient path
 * Interpolates between adjacent color stops for smooth transitions
 */
const getColorAtPosition = (position: number): string => {
  if (position <= 0) return technicolorGradient[0];
  if (position >= 1) return technicolorGradient[technicolorGradient.length - 1];

  // Scale position to the color stops range
  const scaledPosition = position * (technicolorGradient.length - 1);
  const lowerIndex = Math.floor(scaledPosition);
  const upperIndex = Math.ceil(scaledPosition);

  // If we land exactly on a stop, return it directly
  if (lowerIndex === upperIndex) {
    return technicolorGradient[lowerIndex];
  }

  // Interpolate between the two adjacent stops
  const factor = scaledPosition - lowerIndex;
  return interpolateColor(technicolorGradient[lowerIndex], technicolorGradient[upperIndex], factor);
};

/**
 * Generates colors for each character in a text string
 * by interpolating along the vibrant color path defined by technicolorGradient
 */
export const getTechnicolorColors = (text: string): string[] => {
  const length = text.length;
  if (length === 0) return [];
  if (length === 1) return [technicolorGradient[0]];

  return text.split('').map((_, index) => {
    const position = index / (length - 1);
    return getColorAtPosition(position);
  });
};

interface TechnicolorTextProps {
  text: string;
  style?: TextStyle;
}

/**
 * TechnicolorText component that renders each character with a color
 * interpolated between purple (#5C2F70) and yellow (#F7D75C)
 *
 * Uses nested Text components for better performance than separate Text elements
 */
export const TechnicolorText: React.FC<TechnicolorTextProps> = ({ text, style }) => {
  const colors = getTechnicolorColors(text);

  return (
    <Text style={style}>
      {text.split('').map((char, index) => (
        <Text key={`${char}-${index}`} style={{ color: colors[index] }}>
          {char}
        </Text>
      ))}
    </Text>
  );
};

export default TechnicolorText;
