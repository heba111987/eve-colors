import { StyleSheet, Text, View } from 'react-native';

// Placeholder home screen. The template's example tab screens were removed
// in Task 5 (scaffolding); a later task rewrites the app's real navigation
// and screens on top of this foundation.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Eve Colors</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
