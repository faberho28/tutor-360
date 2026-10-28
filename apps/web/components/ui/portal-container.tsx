"use client";

import { createContext, useContext } from "react";

/**
 * Where popovers (Select, DropdownMenu) are drawn. They normally go to
 * <body>, but in fullscreen the browser only shows the fullscreen element and
 * its children, so the stage provides itself while it is fullscreen.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null);

export const PortalContainerProvider = PortalContainerContext.Provider;

export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContainerContext) ?? undefined;
}
