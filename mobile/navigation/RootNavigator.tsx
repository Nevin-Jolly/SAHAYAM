import React, { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import ElderHomeScreen from "../screens/elder/ElderHomeScreen";
import FamilyTabNavigator from "./FamilyTabNavigator";
import LoginScreen from "../screens/LoginScreen";

/**
 * RootNavigator — Phase 6 update.
 *
 * Replaces the hardcoded CURRENT_ROLE constant with a real login flow.
 * Flow:
 *   1. App starts → LoginScreen shown.
 *   2. User taps "Elder" or "Family Member".
 *   3. LoginScreen pings /health, then calls onLogin(role).
 *   4. RootNavigator renders the role-appropriate screen.
 *
 * Role enforcement (Phase 6 RBAC):
 *   - Elder screen calls /voice/*, /chat/respond, /memory/* with X-Role: elder.
 *   - Family screens call /dashboard/*, /medications, /checkins, /escalations
 *     with X-Role: family.
 *   - Backend rejects mismatched roles with 403 (see backend/auth.py).
 *
 * Note: Full credential auth is out of scope for this academic project.
 * Role selection here provides the panel-demonstrable separation.
 */

type Role = "elder" | "family";

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

  // Before login: show login screen (not inside Stack so there's no back gesture)
  if (!role) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login">
            {() => <LoginScreen onLogin={handleLogin} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // After login: render the role-specific navigator
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {role === "elder" ? (
          <Stack.Screen name="ElderHome" component={ElderHomeScreen} />
        ) : (
          <Stack.Screen name="FamilyDashboard" component={FamilyTabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
