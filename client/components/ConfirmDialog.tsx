import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { theme } from '../lib/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}

export function ConfirmDialog({ visible, title, body, confirmLabel, onConfirm, onCancel, confirming }: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Button title={confirmLabel} onPress={onConfirm} loading={confirming} style={{ backgroundColor: theme.colors.accent800 }} />
          <Button title="Keep it" variant="secondary" onPress={onCancel} style={{ marginTop: theme.space[2] }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(88, 70, 84, 0.34)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.bg, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, padding: theme.space[6] },
  title: { fontFamily: theme.font.heading, fontSize: 21, color: theme.colors.text, marginBottom: theme.space[2] },
  body: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.neutral700, marginBottom: theme.space[4] },
});
