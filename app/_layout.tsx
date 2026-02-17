import { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { initDatabase } from "../db/database";
import { MonthProvider, useMonth } from "../utils/MonthContext";
import { FilterProvider } from "../utils/FilterContext";
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
      <Ionicons name="chevron-back" size={24} color="black" />
    </Pressable>
  );
}

function TabsWithMonth() {
  const router = useRouter();
  const { monthLabel } = useMonth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563eb",
        headerStyle: { backgroundColor: "#f8fafc" },
        headerTitleStyle: { fontWeight: "600" },
        headerRight: () => (
          <Pressable
            onPress={() => router.push("/settings")}
            style={{ marginRight: 16, padding: 4 }}
          >
            <EvilIcons name="gear" size={24} color="black" />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: `Overview - ${monthLabel}`,
          tabBarLabel: "Overview",
          tabBarIcon: ({ color }) => <Ionicons name="speedometer-outline" size={24} color={ color } />
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: `Budget - ${monthLabel}`,
          tabBarLabel: "Budget",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="finance" size={24} color={color} />,
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <MonthProvider>
      <FilterProvider>
        <TabsWithMonth />
      </FilterProvider>
    </MonthProvider>
  );
}
