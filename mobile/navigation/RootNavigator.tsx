import React, { useState } from "react";
import { StatusBar } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import ElderHomeScreen from "../screens/elder/ElderHomeScreen";
import FamilyTabNavigator from "./FamilyTabNavigator";
import LoginScreen from "../screens/LoginScreen";
import { Role, RoleContext, useRole, RoleContextType } from "../context/RoleContext";
import { useTheme } from "../context/ThemeContext";

export { Role, RoleContext, useRole, RoleContextType };

export type RootStackParamList = {
  Portal: undefined;
  ElderHome: undefined;
  FamilyDashboard: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [role, setRole] = useState<Role | null>(null);
  const { theme, isDark } = useTheme();

  const handleSelectElder = () => {
    setRole("elder");
  };

  const handleSelectFamily = () => {
    setRole("family");
  };

  const handleLogout = () => {
    setRole(null);
  };

  const navTheme = isDark ? DarkTheme : DefaultTheme;

  return (
    <RoleContext.Provider value={{ role, logout: handleLogout }}>
      <StatusBar
        barStyle={theme.statusBarStyle}
        backgroundColor={theme.statusBarBg}
      />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: theme.background },
          }}
        >
          {!role ? (
            <Stack.Screen name="Portal">
              {() => (
                <LoginScreen
                  onSelectElder={handleSelectElder}
                  onSelectFamily={handleSelectFamily}
                />
              )}
            </Stack.Screen>
          ) : role === "elder" ? (
            <Stack.Screen name="ElderHome" component={ElderHomeScreen} />
          ) : (
            <Stack.Screen name="FamilyDashboard" component={FamilyTabNavigator} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </RoleContext.Provider>
  );
}

