import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initDatabase } from "../db/database";
import { MonthProvider, useMonth } from "../utils/MonthContext";
import { FilterProvider } from "../utils/FilterContext";
import { C } from "../utils/colors";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AntDesign from '@expo/vector-icons/AntDesign';
import Ionicons from '@expo/vector-icons/Ionicons';
import EvilIcons from '@expo/vector-icons/EvilIcons';

function BackButton({ to }: { to: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.navigate(to)}
      style={{ marginLeft: 16, padding: 4 }}
    >
      <Ionicons name="chevron-back" size={24} color={C.textSecondary} />
    </Pressable>
  );
}

function TabsWithMonth() {
  const router = useRouter();
  const { monthLabel } = useMonth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.textTertiary,
        tabBarStyle: { backgroundColor: C.tabBar, borderTopColor: C.separator },
        headerStyle: { backgroundColor: C.header },
        headerTitleStyle: { fontWeight: "600", color: C.textPrimary },
        headerTintColor: C.textSecondary,
        headerRight: () => (
          <Pressable
            onPress={() => router.push("/settings")}
            style={{ marginRight: 16, padding: 4 }}
          >
            <EvilIcons name="gear" size={24} color={C.textSecondary} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: `Overview - ${monthLabel}`,
          tabBarLabel: "Overview",
          tabBarIcon: ({ color }) => <Ionicons name="speedometer-outline" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: `Budget - ${monthLabel}`,
          tabBarLabel: "Budget",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="finance" size={24} color={color} />,
          headerLeft: () => (
            <Pressable
              onPress={() => router.push("/groups")}
              style={{ marginLeft: 16, padding: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: C.accent }}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: `Transactions - ${monthLabel}`,
          tabBarLabel: "Transactions",
          tabBarIcon: ({ color }) => <AntDesign name="unordered-list" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add",
          tabBarLabel: "Add",
          tabBarIcon: ({ color }) => <AntDesign name="file-add" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="edit"
        options={{
          title: "Edit Transaction",
          href: null,
          headerLeft: () => <BackButton to="/transactions" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          href: null,
          headerLeft: () => <BackButton to="/" />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Manage Categories",
          href: null,
          headerLeft: () => <BackButton to="/settings" />,
        }}
      />
      <Tabs.Screen
        name="filters"
        options={{
          title: "Filters",
          href: null,
          headerLeft: () => <BackButton to="/transactions" />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: "Manage Groups",
          href: null,
          headerLeft: () => <BackButton to="/budget" />,
        }}
      />
    </Tabs>
  );
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDatabase().then(() => setDbReady(true));
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MonthProvider>
        <FilterProvider>
          <TabsWithMonth />
        </FilterProvider>
      </MonthProvider>
    </GestureHandlerRootView>
  );
}
