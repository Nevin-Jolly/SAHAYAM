import React from "react";
import { View, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import OverviewTab from "../screens/family/OverviewTab";
import MedicationsTab from "../screens/family/MedicationsTab";
import CheckinsTab from "../screens/family/CheckinsTab";
import SettingsTab from "../screens/family/SettingsTab";
import FamilyPushNotificationBanner from "../components/FamilyPushNotificationBanner";
import { useTheme } from "../context/ThemeContext";

export type FamilyTabParamList = {
  Overview: undefined;
  Medications: undefined;
  "Check-ins": undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<FamilyTabParamList>();

export default function FamilyTabNavigator() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FamilyPushNotificationBanner />
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
          tabBarActiveTintColor: theme.tabBarActive,
          tabBarInactiveTintColor: theme.tabBarInactive,
          tabBarStyle: {
            backgroundColor: theme.tabBarBg,
            borderTopColor: theme.tabBarBorder,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Overview" component={OverviewTab} options={{ title: "Overview", tabBarLabel: "Overview" }} />
        <Tab.Screen name="Medications" component={MedicationsTab} options={{ title: "Medications", tabBarLabel: "Medications" }} />
        <Tab.Screen name="Check-ins" component={CheckinsTab} options={{ title: "Check-ins", tabBarLabel: "Check-ins" }} />
        <Tab.Screen name="Settings" component={SettingsTab} options={{ title: "Settings", tabBarLabel: "Settings" }} />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

