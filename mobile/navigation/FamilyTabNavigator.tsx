import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import OverviewTab from "../screens/family/OverviewTab";
import MedicationsTab from "../screens/family/MedicationsTab";
import CheckinsTab from "../screens/family/CheckinsTab";
import SettingsTab from "../screens/family/SettingsTab";

export type FamilyTabParamList = {
  Overview: undefined;
  Medications: undefined;
  "Check-ins": undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<FamilyTabParamList>();

export default function FamilyTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          switch (route.name) {
            case "Overview":
              iconName = focused ? "home" : "home-outline";
              break;
            case "Medications":
              iconName = focused ? "medical" : "medical-outline";
              break;
            case "Check-ins":
              iconName = focused ? "checkmark-circle" : "checkmark-circle-outline";
              break;
            case "Settings":
              iconName = focused ? "settings" : "settings-outline";
              break;
            default:
              iconName = "ellipse-outline";
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#6C63FF",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: {
          backgroundColor: "#1A1A2E",
          borderTopColor: "#2A2A4A",
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerStyle: { backgroundColor: "#1A1A2E" },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
      })}
    >
      <Tab.Screen name="Overview" component={OverviewTab} options={{ title: "Overview" }} />
      <Tab.Screen name="Medications" component={MedicationsTab} options={{ title: "Medications" }} />
      <Tab.Screen name="Check-ins" component={CheckinsTab} options={{ title: "Check-ins & Escalations" }} />
      <Tab.Screen name="Settings" component={SettingsTab} options={{ title: "Settings" }} />
    </Tab.Navigator>
  );
}
