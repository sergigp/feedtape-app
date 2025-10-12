import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

export const SplashScreen: React.FC = () => {
  React.useEffect(() => {
    console.log('[SplashScreen] Mounting');

    return () => {
      console.log('[SplashScreen] Unmounting');
    };
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/feedtape-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    height: 150,
    width: 150,
  },
});
