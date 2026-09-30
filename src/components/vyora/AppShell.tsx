import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useVyora } from "@/lib/vyora/store";
import { ConnectScreen } from "./ConnectScreen";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const { status } = useVyora();
  const [navOpen, setNavOpen] = useState(false);

  if (!status?.connected) return <ConnectScreen />;

  return (
    <div className="flex min-h-screen min-w-0 overflow-x-hidden md:h-screen">
      <div className="hidden w-64 shrink-0 md:block">
        <Sidebar />
      </div>

      {navOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="absolute inset-0 bg-background/80"
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 w-72" onClick={() => setNavOpen(false)}>
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden md:min-h-0">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNavOpen((open) => !open)}
            aria-label={navOpen ? "Close navigation" : "Open navigation"}
          >
            {navOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <span className="text-sm font-semibold tracking-[0.2em]">VYORA</span>
        </div>
        {children}
      </div>
    </div>
  );
}
