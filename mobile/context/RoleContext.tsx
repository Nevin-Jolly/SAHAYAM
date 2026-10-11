import React, { createContext, useContext } from "react";

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
