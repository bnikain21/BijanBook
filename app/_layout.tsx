import { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { initDatabase } from "../db/database";
import { MonthProvider, useMonth } from "../utils/MonthContext";

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
        options={{ title: "Edit Transaction", href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", href: null }}
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
      <TabsWithMonth />
    </MonthProvider>
  );
}
