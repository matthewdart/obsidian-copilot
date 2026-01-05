import { Badge } from "@/components/ui/badge";
import { useIsPlusUser } from "@/plusUtils";
import React from "react";

export function PlusSettings() {
  const isPlusUser = useIsPlusUser();

  return (
    <section className="tw-flex tw-flex-col tw-gap-4 tw-rounded-lg tw-bg-secondary tw-p-4">
      <div className="tw-flex tw-items-center tw-justify-between tw-gap-2 tw-text-xl tw-font-bold">
        <span>Copilot Plus</span>
        {isPlusUser && (
          <Badge variant="outline" className="tw-text-success">
            Active
          </Badge>
        )}
      </div>
      <div className="tw-flex tw-flex-col tw-gap-2 tw-text-sm tw-text-muted">
        <div>
          Copilot Plus features are now included by default. No license key or activation is
          required&mdash;you already have access to enhanced models, document parsing, web search,
          and YouTube transcription.
        </div>
      </div>
    </section>
  );
}
