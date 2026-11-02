import { UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ReferralPanel } from "@/components/dashboard/ReferralPanel";

/** Header-actie voor ingelogde leden: uitnodigingslink + beloningsvoortgang in een modal. */
export function InviteButton() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5" aria-label="Uitnodigen">
          <UserPlus className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Invite</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nodig vrienden uit</DialogTitle>
          <DialogDescription>
            Deel je persoonlijke link en volg je beloningen.
          </DialogDescription>
        </DialogHeader>
        <ReferralPanel />
      </DialogContent>
    </Dialog>
  );
}
