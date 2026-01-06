import React, { useState, useCallback } from "react";
import { TFile, App } from "obsidian";
import ChatInput from "./ChatInput";
import { ChatMessage } from "@/types/message";

interface InlineMessageEditorProps {
  /** The initial message text to edit */
  initialValue: string;
  /** The original message context (notes, URLs, tags, folders) */
  initialContext?: ChatMessage["context"];
  /** Callback when the edit is saved */
  onSave: (newText: string, newContext: ChatMessage["context"]) => void;
  /** Callback when the edit is cancelled */
  onCancel: () => void;
  /** Obsidian app instance */
  app: App;
}

/**
 * InlineMessageEditor wraps ChatInput in edit mode to provide the full chat input experience
 * for editing messages inline, including all context controls, tool buttons, and UI elements.
 */
export const InlineMessageEditor: React.FC<InlineMessageEditorProps> = ({
  initialValue,
  initialContext,
  onSave,
  onCancel,
  app,
}) => {
  const [inputMessage, setInputMessage] = useState(initialValue);

  // Convert initialContext to the format expected by ChatInput
  const [contextNotes, setContextNotes] = useState<TFile[]>(
    initialContext?.notes?.map((note) => note as TFile) || []
  );
  const [includeActiveNote, setIncludeActiveNote] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);

  // Handle saving the edited message
  const handleEditSave = useCallback(
    (
      text: string,
      context: {
        notes: TFile[];
        urls: string[];
        folders: string[];
      }
    ) => {
      // Convert back to ChatMessage context format
      const newContext: ChatMessage["context"] = {
        notes: context.notes,
        urls: context.urls,
        tags: initialContext?.tags || [],
        folders: context.folders,
        selectedTextContexts: initialContext?.selectedTextContexts || [],
      };

      onSave(text, newContext);
    },
    [initialContext?.selectedTextContexts, initialContext?.tags, onSave]
  );

  // Handle cancelling the edit
  const handleEditCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  // Dummy handlers for required ChatInput props
  const handleSendMessage = useCallback(() => {
    // This should never be called in edit mode, but required for interface
  }, []);

  const handleStopGenerating = useCallback(() => {
    // Not used in edit mode
  }, []);

  const handleAddImage = useCallback((files: File[]) => {
    setSelectedImages((prev) => [...prev, ...files]);
  }, []);

  // Prepare initial context for ChatInput
  const initialChatInputContext = {
    notes: contextNotes,
    urls: initialContext?.urls || [],
    folders: initialContext?.folders || [],
  };

  return (
    <ChatInput
      inputMessage={inputMessage}
      setInputMessage={setInputMessage}
      handleSendMessage={handleSendMessage}
      isGenerating={false}
      onStopGenerating={handleStopGenerating}
      app={app}
      contextNotes={contextNotes}
      setContextNotes={setContextNotes}
      includeActiveNote={includeActiveNote}
      setIncludeActiveNote={setIncludeActiveNote}
      selectedImages={selectedImages}
      onAddImage={handleAddImage}
      setSelectedImages={setSelectedImages}
      disableModelSwitch={false}
      editMode={true}
      onEditSave={handleEditSave}
      onEditCancel={handleEditCancel}
      initialContext={initialChatInputContext}
    />
  );
};
