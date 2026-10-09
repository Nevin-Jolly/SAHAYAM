import "react-native-gesture-handler"; // Must be the first import
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import RootNavigator from "./navigation/RootNavigator";

/**
 * SAHAYAM — App entry point
 *
 * Renders the role-based root navigator wrapped in GestureHandlerRootView,
 * which is required by react-native-gesture-handler v2+.
 * Role switching (elder ↔ family) is hardcoded in RootNavigator for Phase 0.
 * Auth-based role selection is added in a later phase.
 */
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootNavigator />
    </GestureHandlerRootView>
  );
}
