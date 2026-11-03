"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/session/session-provider";

/**
 * Asks before throwing the scan away when there is something to lose: captures
 * that were not turned into a report yet.
 */
export function ResetContextDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const captures = useSession((s) => s.captures.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset the context?</DialogTitle>
          <DialogDescription>
            The detected parts, the diagnoses and the steps are deleted
            {captures > 0
              ? ` along with the ${captures} capture${captures > 1 ? "s" : ""} (they can no longer be used in the report)`
              : ""}
            . The camera and the case are kept.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full px-4 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="inverse"
            size="sm"
            className="rounded-full px-4 text-xs"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
