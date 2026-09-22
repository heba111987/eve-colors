import { StyleSheet, View, ViewProps } from 'react-native';
import { theme } from '../lib/theme';

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.colors.neutral200,
    borderRadius: theme.radius.lg,
    padding: theme.space[4],
  },
});
