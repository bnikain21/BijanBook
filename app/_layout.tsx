import { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { initDatabase } from "../db/database";
import { MonthProvider, useMonth } from "../utils/MonthContext";
import { FilterProvider } from "../utils/FilterContext";

function BackButton({ to }: { to: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.navigate(to)}
      style={{ marginLeft: 16, padding: 4 }}
    >
      <Text style={{ fontSize: 16, color: "#2563eb", fontWeight: "600" }}>
        {"< Back"}
      </Text>
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
            <Text style={{ fontSize: 22 }}>{"\u2699\uFE0F"}</Text>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: `Overview - ${monthLabel}`, tabBarLabel: "Overview" }}
      />
      <Tabs.Screen
        name="budget"
        options={{ title: `Budget - ${monthLabel}`, tabBarLabel: "Budget" }}
      />
      <Tabs.Screen
        name="transactions"
        options={{ title: `Transactions - ${monthLabel}`, tabBarLabel: "Transactions" }}
      />
      <Tabs.Screen
        name="add"
        options={{ title: "Add", tabBarLabel: "Add" }}
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
