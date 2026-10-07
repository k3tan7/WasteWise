// Route-level loading state for the app shell: shown while a server-rendered
// page (dashboard, inventory, waste…) is being fetched on the server. Prevents
// the "dead click" feel on slow/cold-start deployments.
import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-ink-400" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      <p className="text-xs font-medium">Loading…</p>
    </div>
  );
}
