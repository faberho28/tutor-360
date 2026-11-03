"use client";

import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Settings dialog; `children` is the element that opens it. */
export function SettingsDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Choose the interface theme.</DialogDescription>
        </DialogHeader>
        <ThemeToggle />
      </DialogContent>
    </Dialog>
  );
}
