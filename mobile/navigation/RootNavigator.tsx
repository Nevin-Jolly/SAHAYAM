import React, { useState, createContext, useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import ElderHomeScreen from "../screens/elder/ElderHomeScreen";
import FamilyTabNavigator from "./FamilyTabNavigator";
import LoginScreen from "../screens/LoginScreen";

export type Role = "elder" | "family";

export interface RoleContextType {
  role: Role | null;
  logout: () => void;
}

export const RoleContext = createContext<RoleContextType>({
  role: null,
  logout: () => {},
});

export const useRole = () => useContext(RoleContext);

export type RootStackParamList = {
  Login: undefined;
  ElderHome: undefined;
  FamilyDashboard: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [role, setRole] = useState<Role | null>(null);

  const handleLogin = (selectedRole: Role) => {
    setRole(selectedRole);
  };

  const handleLogout = () => {
    setRole(null);
  };

  return (
    <RoleContext.Provider value={{ role, logout: handleLogout }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!role ? (
            <Stack.Screen name="Login">
              {() => <LoginScreen onLogin={handleLogin} />}
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
