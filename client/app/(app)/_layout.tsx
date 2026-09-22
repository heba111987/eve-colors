import { Tabs } from 'expo-router';
import { Compass, Flower2, User } from 'lucide-react-native';
import { theme } from '../../lib/theme';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent700,
        tabBarInactiveTintColor: theme.colors.neutral600,
        tabBarStyle: { borderTopColor: theme.colors.neutral200, backgroundColor: '#fffdfa' },
        tabBarLabelStyle: { fontFamily: theme.font.bodySemibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Compass color={color} size={size} strokeWidth={2.75} /> }}
      />
      <Tabs.Screen
        name="garden/index"
        options={{ title: 'Garden', tabBarIcon: ({ color, size }) => <Flower2 color={color} size={size} strokeWidth={2.75} /> }}
      />
      <Tabs.Screen
        name="garden/[id]"
        options={{ href: null }} // reachable only via navigation, not a tab
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'You', tabBarIcon: ({ color, size }) => <User color={color} size={size} strokeWidth={2.75} /> }}
      />
    </Tabs>
  );
}
