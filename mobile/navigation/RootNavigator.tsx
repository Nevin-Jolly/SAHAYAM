import React, { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import ElderHomeScreen from "../screens/elder/ElderHomeScreen";
import FamilyTabNavigator from "./FamilyTabNavigator";
import LoginScreen from "../screens/LoginScreen";
import { Role, RoleContext, useRole, RoleContextType } from "../context/RoleContext";

export { Role, RoleContext, useRole, RoleContextType };

export type RootStackParamList = {
  Portal: undefined;
  ElderHome: undefined;
  FamilyDashboard: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [role, setRole] = useState<Role | null>(null);

  const handleSelectElder = () => {
    setRole("elder");
  };

  const handleSelectFamily = () => {
    setRole("family");
  };

  const handleLogout = () => {
    setRole(null);
  };

  return (
    <RoleContext.Provider value={{ role, logout: handleLogout }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
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
