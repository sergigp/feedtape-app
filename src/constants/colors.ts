// Design system colors adapted from Figma + Gemini implementation
// Purple to orange gradient theme

export const colors = {
  // Background & Foreground
  background: "#FFFFFF",
  backgroundWhite: "#FFFFFF",
  foreground: "#000000",
  foregroundDark: "#333333",

  // Muted (for secondary text, disabled states)
  muted: "#EEEEEE",
  mutedForeground: "#888888",
  grayedOut: "#C4C4C4",

  // Borders & Dividers
  border: "#EEEEEE",

  // Text variations
  foregroundLight: "#CCCCCC",
  foregroundMedium: "#888888",

  // Brand gradient colors (purple to orange/yellow)
  brandPurple: "#6A3093",
  brandOrange: "#F05053",
  brandYellow: "#FFC107",

  // Logo colors (legacy)
  logoMain: "#6A3093", // Purple
  logoAccent: "#FFC107", // Yellow/Orange

  // Technicolor text waypoints (purple → magenta → pink → red → orange → yellow)
  technicolorStart: "#5C2F70", // Purple
  technicolorEnd: "#F7D75C", // Yellow

  // Play button gradient
  playGradientStart: "#6A3093",
  playGradientEnd: "#F05053",

  // Progress bar gradient
  progressStart: "#8E2DE2",
  progressEnd: "#FF512F",

  // Cassette colors
  cassetteOrange: "#F5A623",
  cassetteBg: "#FFE0B2",

  // Card
  cardBg: "#F8F8F8",

  // Player specific
  playerBg: "#FFFFFF",

  // Interactive elements
  buttonBg: "#000000",
  buttonText: "#FFFFFF",

  // Active/Selected states
  activeText: "#000000",
  inactiveText: "#888888",
};

// Opacity values for consistent transparency
export const opacity = {
  disabled: 0.5,
  light: 0.8,
  medium: 0.6,
  subtle: 0.5,
};

// Technicolor gradient colors (purple to yellow) - shared by TechnicolorText and TechnicolorButton
export const technicolorGradient = [
  "#5C2F70", // Purple (start)
  "#733483", // Purple-magenta
  "#893781", // Magenta
  "#A13B7A", // Pink-magenta
  "#BA416E", // Pink-coral
  "#D24A5A", // Coral-red
  "#E66141", // Orange-red
  "#F7D75C", // Yellow (end)
] as const;

// Striped gradient colors for TechnicolorButton (each color repeated for sharp stripes)
export const technicolorStripeColors = [
  "#5C2F70", "#5C2F70",
  "#733483", "#733483",
  "#893781", "#893781",
  "#A13B7A", "#A13B7A",
  "#BA416E", "#BA416E",
  "#D24A5A", "#D24A5A",
  "#E66141", "#E66141",
  "#F7D75C", "#F7D75C",
] as const;

// Locations for striped gradient effect in TechnicolorButton
export const technicolorStripeLocations = [
  0, 0.12,      // Purple
  0.13, 0.24,   // Purple-magenta
  0.25, 0.36,   // Magenta
  0.37, 0.48,   // Pink-magenta
  0.49, 0.6,    // Pink-coral
  0.61, 0.72,   // Coral-red
  0.73, 0.84,   // Orange-red
  0.85, 0.97,   // Yellow
] as const;
