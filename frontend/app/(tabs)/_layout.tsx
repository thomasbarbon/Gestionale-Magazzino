import { Tabs } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Icon name="speedometer-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="magazzino"
        options={{
          title: "Magazzino",
          tabBarIcon: ({ color, size }) => (
            <Icon name="file-tray-stacked-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
