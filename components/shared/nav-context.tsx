"use client";

import { createContext, useContext } from "react";
import type { NavGroup } from "./nav-types";

const NavGroupsContext = createContext<NavGroup[]>([]);

export function NavGroupsProvider({ groups, children }: { groups: NavGroup[]; children: React.ReactNode }) {
  return <NavGroupsContext.Provider value={groups}>{children}</NavGroupsContext.Provider>;
}

export function useNavGroups() {
  return useContext(NavGroupsContext);
}
