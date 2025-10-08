// Design system colors extracted from web prototype
// Original HSL values converted to RGB for React Native

export const colors = {
  // Background & Foreground
  background: '#FFFFFF',        // hsl(0 0% 100%)
  foreground: '#1A1A1A',        // hsl(0 0% 10%)

  // Muted (for progress bars, disabled states)
  muted: '#F5F5F5',             // hsl(0 0% 96%)
  mutedForeground: '#808080',   // hsl(0 0% 50%)

  // Borders & Dividers
  border: '#F0F0F0',            // hsl(0 0% 94%)

  // Text variations
  foregroundLight: '#CCCCCC',   // ~80% opacity on foreground
  foregroundMedium: '#999999',  // ~60% opacity on foreground

  // Player specific
  playerBg: '#FFFFFF',
  playerShadow: '#F0F0F0',

  // Interactive elements
  buttonBg: '#1A1A1A',          // hsl(0 0% 10%) - dark foreground for main button
  buttonText: '#FFFFFF',

  // Active/Selected states
  activeText: '#1A1A1A',        // Darker for active items
  inactiveText: '#CCCCCC',      // Lighter for inactive items
};

// Opacity values for consistent transparency
export const opacity = {
  disabled: 0.5,
  light: 0.8,
  medium: 0.6,
  subtle: 0.5,
};
