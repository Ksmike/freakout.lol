"use client";

import { useState } from "react";
import { ApiKeyCard, type ApiKeyConnectorLabels } from "./ApiKeyCard";
import type { ApiKeyStatus } from "@/lib/actions/apiKeys";

export function ApiKeySection({
  initial,
  labels,
}: {
  initial: ApiKeyStatus[];
  labels: ApiKeyConnectorLabels;
}) {
  const [statuses, setStatuses] = useState(initial);

  function handleUpdate(updated: ApiKeyStatus) {
    setStatuses((prev) =>
      prev.map((s) => (s.provider === updated.provider ? updated : s))
    );
  }

  return (
    <div className="space-y-3">
      {statuses.map((status) => (
        <ApiKeyCard
          key={status.provider}
          initial={status}
          labels={labels}
          onUpdate={handleUpdate}
        />
      ))}
    </div>
  );
}
