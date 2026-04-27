"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type MaintenanceState = {
  enabled: boolean;
  message: string;
};

export function AppMaintenanceGate() {
  const pathname = usePathname();
  const [maintenance, setMaintenance] = useState<MaintenanceState | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/admin/portal/public-settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (active) {
          setMaintenance(payload?.maintenance ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setMaintenance(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (!maintenance?.enabled || pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <div className="vyb-maintenance-screen" role="alert" aria-live="assertive">
      <div>
        <span>VYB</span>
        <h1>{maintenance.message}</h1>
        <p>We paused the app so data stays safe while the team fixes things.</p>
      </div>
    </div>
  );
}
