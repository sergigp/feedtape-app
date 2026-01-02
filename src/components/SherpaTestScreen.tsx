import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import sherpaOnnxService from '../services/sherpaOnnxService';

export function SherpaTestScreen() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  const handleInitialize = async () => {
    try {
      addLog('Starting initialization...');
      await sherpaOnnxService.initialize('en');
      setIsInitialized(true);
      addLog('✓ Initialization successful!');
    } catch (error) {
      addLog(`✗ Initialization failed: ${error}`);
      Alert.alert('Error', `Failed to initialize: ${error}`);
    }
  };

  const handleGenerateAndPlay = async () => {
    try {
      const testText = `BlackBerry will never die, not so long as the legion of Dr. Frankensteins keeps trying to bring it back with a new name. Ahead of CES 2026, the Clicks keyboard case has returned, and after several years of iterations, the accessory may finally make sense for folks who hate typing on touchscreens. Instead of layering a massive keyboard beard hanging off the bottom of your phone, the new Power Keyboard is now a power bank that attaches with MagSafe. To keep it more contained, the keyboard slides into your awaiting palm like an old-school Nokia Sidekick.

The Power Keyboard—made by Clicks, which is fronted by YouTuber Michael Fisher, aka MrMobile—is basically a slide-out keyboard built into a 2,150 mAh battery. It's compatible with MagSafe and Qi2 for iPhones and Android phones. Instead of physically connecting to your phone's USB-C port like past versions, the Power Keyboard will depend on your device's Bluetooth connection.`;
      addLog(`Testing speak() API (${testText.length} chars)...`);

      // Use the new speak() API with callbacks
      await sherpaOnnxService.speak(testText, {
        language: 'en-US',
        rate: 1.0,
        onStart: () => {
          addLog('✓ onStart callback fired');
          setIsPlaying(true);
        },
        onDone: () => {
          addLog('✓ onDone callback fired');
          setIsPlaying(false);
        },
        onError: (error) => {
          addLog(`✗ onError callback fired: ${error.message}`);
          setIsPlaying(false);
        },
      });

      addLog('✓ speak() call completed');
    } catch (error) {
      addLog(`✗ Failed: ${error}`);
      Alert.alert('Error', `Failed: ${error}`);
    }
  };

  const handleSpeakWithTitle = async () => {
    try {
      const title = 'Clicks Power Keyboard Returns';
      const content = `BlackBerry will never die, not so long as the legion of Dr. Frankensteins keeps trying to bring it back with a new name. Ahead of CES 2026, the Clicks keyboard case has returned, and after several years of iterations, the accessory may finally make sense for folks who hate typing on touchscreens. Instead of layering a massive keyboard beard hanging off the bottom of your phone, the new Power Keyboard is now a power bank that attaches with MagSafe. To keep it more contained, the keyboard slides into your awaiting palm like an old-school Nokia Sidekick.`;

      addLog(`Testing speakWithTitle() API...`);
      addLog(`Title: "${title}"`);
      addLog(`Content: ${content.length} chars`);

      // Use speakWithTitle API
      await sherpaOnnxService.speakWithTitle(title, content, {
        language: 'en-US',
        onStart: () => {
          addLog('✓ onStart callback fired');
          setIsPlaying(true);
        },
        onDone: () => {
          addLog('✓ onDone callback fired');
          setIsPlaying(false);
        },
        onError: (error) => {
          addLog(`✗ onError callback fired: ${error.message}`);
          setIsPlaying(false);
        },
      });

      addLog('✓ speakWithTitle() call completed');
    } catch (error) {
      addLog(`✗ Failed: ${error}`);
      Alert.alert('Error', `Failed: ${error}`);
    }
  };

  const handlePause = async () => {
    try {
      if (isPlaying) {
        await sherpaOnnxService.pause();
        setIsPlaying(false);
        addLog('⏸ Paused');
      } else {
        await sherpaOnnxService.resume();
        setIsPlaying(true);
        addLog('▶ Resumed');
      }
    } catch (error) {
      addLog(`✗ Pause/Resume failed: ${error}`);
    }
  };

  const handleStop = async () => {
    try {
      await sherpaOnnxService.stop();
      setIsPlaying(false);
      addLog('⏹ Stopped');
    } catch (error) {
      addLog(`✗ Stop failed: ${error}`);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sherpa ONNX Test</Text>

      <View style={styles.buttonContainer}>
        <Button title="Initialize" onPress={handleInitialize} disabled={isInitialized} />
        <View style={styles.spacer} />
        <Button title="Test speak()" onPress={handleGenerateAndPlay} />
        <View style={styles.spacer} />
        <Button title="Test speakWithTitle()" onPress={handleSpeakWithTitle} />
        <View style={styles.spacer} />
        <Button
          title={isPlaying ? 'Pause' : 'Resume'}
          onPress={handlePause}
          disabled={!isPlaying}
        />
        <View style={styles.spacer} />
        <Button title="Stop" onPress={handleStop} disabled={!isPlaying} />
        <View style={styles.spacer} />
        <Button title="Clear Logs" onPress={handleClearLogs} />
      </View>

      <ScrollView style={styles.logContainer}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>
            {log}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'column',
    marginBottom: 20,
  },
  spacer: {
    height: 10,
  },
  logContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 5,
  },
});
