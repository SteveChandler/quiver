"use client";

import type { ReactElement } from "react";
import { BeachSelector } from "@/components/BeachSelector";
import { Button } from "@/components/ui/button";
import type { ImportBeach } from "@/lib/sessions/imports/resolve-import-beach";

type ImportBeachPickerProps = {
  candidates: ImportBeach[];
  onChoose: (beachId: string) => Promise<void>;
};

export function ImportBeachPicker({ candidates, onChoose }: ImportBeachPickerProps): ReactElement {
  return (
    <div className="space-y-3">
      <p className="font-heading text-lg font-bold text-[#11100D]">Where did you surf?</p>
      {candidates.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Suggested beaches">
          {candidates.map((beach) => (
            <Button key={beach.id} type="button" variant="outline" onClick={() => void onChoose(beach.id)}>
              {beach.name}
            </Button>
          ))}
        </div>
      ) : null}
      <div>
        <p className="mb-2 text-sm text-[#11100D]/70">Or search for a beach</p>
        <BeachSelector onBeachSelected={(beach) => {
          if (beach.id) void onChoose(beach.id);
        }} />
      </div>
    </div>
  );
}
