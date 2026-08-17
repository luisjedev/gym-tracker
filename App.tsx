import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ANDROID · EXPO</Text>
        <Text style={styles.title}>Gym Tracker</Text>
        <Text style={styles.subtitle}>
          Entorno preparado. Ya podemos empezar a construir.
        </Text>
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F4F7F5',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  eyebrow: {
    marginBottom: 10,
    color: '#287A4D',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: '#14251B',
    fontSize: 34,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 12,
    color: '#526158',
    fontSize: 17,
    lineHeight: 25,
  },
});
