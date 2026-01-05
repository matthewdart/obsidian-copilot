import { isAllowedFileForNoteContext } from "@/utils";
import { App, FileView, TFile, WorkspaceLeaf } from "obsidian";

let lastActiveContextFile: TFile | null = null;

/**
 * Returns the file from a workspace leaf if it is eligible for note context.
 * @param leaf The workspace leaf to inspect.
 * @returns The context-eligible file, or null when none is available.
 */
export function getLeafContextFile(leaf: WorkspaceLeaf | null): TFile | null {
  if (!leaf) {
    return null;
  }

  const view = leaf.view;
  const file = view instanceof FileView ? view.file : null;
  return isAllowedFileForNoteContext(file) ? file : null;
}

/**
 * Track the most recent context-eligible file from a leaf change.
 * @param leaf The workspace leaf that became active.
 */
export function trackLeafContextFile(leaf: WorkspaceLeaf | null): void {
  const file = getLeafContextFile(leaf);
  trackContextFile(file);
}

/**
 * Track the most recent context-eligible file directly.
 * @param file The file to track when it is eligible for context.
 */
export function trackContextFile(file: TFile | null): void {
  if (isAllowedFileForNoteContext(file)) {
    lastActiveContextFile = file;
  }
}

/**
 * Returns the last tracked context-eligible file.
 * @returns The last tracked file, or null if none has been tracked.
 */
export function getLastActiveContextFile(): TFile | null {
  return lastActiveContextFile;
}

/**
 * Returns the current active context-eligible file with a last-known fallback.
 * @param app The Obsidian app instance.
 * @returns The active context file or the last tracked file if the active leaf is not a file.
 */
export function getActiveContextFile(app: App): TFile | null {
  const activeFile = app.workspace.getActiveFile();
  if (isAllowedFileForNoteContext(activeFile)) {
    trackContextFile(activeFile);
    return activeFile;
  }
  return lastActiveContextFile;
}
