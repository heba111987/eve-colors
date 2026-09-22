import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { theme } from '../lib/theme';

interface TextFieldProps extends TextInputProps {
  multiline?: boolean;
}

export function TextField({ style, multiline, ...props }: TextFieldProps) {
  return (
    <TextInput
      style={[styles.base, multiline && styles.multiline, style]}
      placeholderTextColor={theme.colors.neutral500}
      multiline={multiline}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontFamily: theme.font.body,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.colors.neutral300,
    borderRadius: theme.radius.lg,
  },
  multiline: {
    minHeight: 168,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
});
