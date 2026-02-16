import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { initDatabase } from "../db/database";

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
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563eb",
        headerStyle: { backgroundColor: "#f8fafc" },
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Overview", tabBarLabel: "Overview" }}
      />
      <Tabs.Screen
        name="budget"
        options={{ title: "Budget", tabBarLabel: "Budget" }}
      />
      <Tabs.Screen
        name="transactions"
        options={{ title: "Transactions", tabBarLabel: "Transactions" }}
      />
      <Tabs.Screen
        name="add"
        options={{ title: "Add", tabBarLabel: "Add" }}
      />
      <Tabs.Screen
        name="edit"
        options={{ title: "Edit Transaction", href: null }}
      />
    </Tabs>
  );
}
