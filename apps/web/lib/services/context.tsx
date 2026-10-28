"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ScanServices } from "./types";

const ServicesContext = createContext<ScanServices | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: ScanServices;
  children: ReactNode;
}) {
  return <ServicesContext value={services}>{children}</ServicesContext>;
}

export function useServices(): ScanServices {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error("useServices must be used within a ServicesProvider");
  }
  return services;
}
