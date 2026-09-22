import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';

interface TagProps {
  label: string;
  tint: string;
  ink: string;
}

export function Tag({ label, tint, ink }: TagProps) {
  return (
    <View style={[styles.tag, { backgroundColor: tint }]}>
      <Text style={[styles.label, { color: ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderRadius: theme.radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: theme.font.body,
    fontSize: 11,
    letterSpacing: 0.4,
  },
});
