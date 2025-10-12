import React from 'react';
import { Text } from 'react-native';

// Mock all expo vector icon sets
const createMockIcon = (name: string) => {
  const MockIcon = (props: any) => {
    return <Text testID={`icon-${name}-${props.name}`}>{props.name || name}</Text>;
  };
  MockIcon.displayName = name;
  return MockIcon;
};

export const Ionicons = createMockIcon('Ionicons');
export const MaterialIcons = createMockIcon('MaterialIcons');
export const MaterialCommunityIcons = createMockIcon('MaterialCommunityIcons');
export const FontAwesome = createMockIcon('FontAwesome');
export const FontAwesome5 = createMockIcon('FontAwesome5');
export const Feather = createMockIcon('Feather');
export const AntDesign = createMockIcon('AntDesign');
export const Entypo = createMockIcon('Entypo');
export const EvilIcons = createMockIcon('EvilIcons');
export const Foundation = createMockIcon('Foundation');
export const Octicons = createMockIcon('Octicons');
export const SimpleLineIcons = createMockIcon('SimpleLineIcons');
export const Zocial = createMockIcon('Zocial');
