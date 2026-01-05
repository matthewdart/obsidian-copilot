import { EVENT_NAMES } from "@/constants";
import { EventTargetContext } from "@/context";
import { getActiveContextFile } from "@/state/activeFileTracker";
import { TFile } from "obsidian";
import { useContext, useEffect, useState } from "react";

/**
 * Returns the current context-eligible file, keeping the last active file as a fallback.
 */
export function useActiveFile() {
  const [activeFile, setActiveFile] = useState<TFile | null>(() => getActiveContextFile(app));
  const eventTarget = useContext(EventTargetContext);

  useEffect(() => {
    const handleActiveLeafChange = () => {
      setActiveFile(getActiveContextFile(app));
    };
    eventTarget?.addEventListener(EVENT_NAMES.ACTIVE_LEAF_CHANGE, handleActiveLeafChange);
    return () => {
      eventTarget?.removeEventListener(EVENT_NAMES.ACTIVE_LEAF_CHANGE, handleActiveLeafChange);
    };
  }, [eventTarget]);

  return activeFile;
}
