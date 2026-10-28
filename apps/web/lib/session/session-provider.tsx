"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import {
  createSessionStore,
  type SessionSlice,
  type SessionState,
  type SessionStore,
} from "./store";

const SessionContext = createContext<SessionStore | null>(null);

export function SessionProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: Partial<SessionState>;
}) {
  // One store per provider; the initializer runs once.
  const [store] = useState(() => createSessionStore(initialState));
  return <SessionContext value={store}>{children}</SessionContext>;
}

/** The store itself, for imperative access (event handlers, sources). */
export function useSessionStore(): SessionStore {
  const store = useContext(SessionContext);
  if (!store) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return store;
}

/**
 * Subscribes to a slice of the session. Selectors that build a new array or
 * object on every call must be wrapped with `useShallow` from
 * "zustand/react/shallow".
 */
export function useSession<T>(selector: (state: SessionSlice) => T): T {
  return useStore(useSessionStore(), selector);
}
