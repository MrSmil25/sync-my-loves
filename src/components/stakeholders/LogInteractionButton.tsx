import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InteractionLogDialog,
  type InteractionTarget,
} from "@/components/stakeholders/InteractionLogDialog";

/** Tombol menonjol untuk mencatat interaksi dengan sasaran sudah terisi. */
export function LogInteractionButton({
  target,
  label = "Log Interaksi",
  size = "default",
  variant = "default",
  autoOpen = false,
}: {
  target: InteractionTarget;
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary";
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <MessageSquarePlus className="size-4" /> + {label}
      </Button>
      <InteractionLogDialog open={open} onOpenChange={setOpen} target={target} />
    </>
  );
}
