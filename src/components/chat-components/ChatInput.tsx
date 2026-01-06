import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, MoreHorizontal, StopCircle, X } from "lucide-react";
import { App, Menu, Notice, TFile } from "obsidian";

import {
  getCurrentProject,
  ProjectConfig,
  setCurrentProject,
  subscribeToProjectChange,
  useChainType,
  useModelKey,
  useProjectLoading,
} from "@/aiParams";
import { ChainType } from "@/chainFactory";
import {
  forceRebuildCurrentProjectContext,
  forceReindexVault,
  refreshVaultIndex,
  reloadCurrentProject,
} from "@/components/chat-components/ChatControls";
import {
  ChatHistoryPopover,
  ChatHistoryItem,
} from "@/components/chat-components/ChatHistoryPopover";
import LexicalEditor from "@/components/chat-components/LexicalEditor";
import { $removePillsByToolName } from "@/components/chat-components/pills/ToolPillNode";
import { AddImageModal } from "@/components/modals/AddImageModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Button } from "@/components/ui/button";
import { getModelDisplayText } from "@/components/ui/model-display";
import { useActiveFile as useWorkspaceActiveFile } from "@/hooks/useActiveFile";
import { navigateToPlusPage, useIsPlusUser } from "@/plusUtils";
import { useSettingsValue, updateSetting, getModelKeyFromModel } from "@/settings/model";
import { checkModelApiKey, isPlusChain } from "@/utils";
import { PLUS_UTM_MEDIUMS } from "@/constants";

interface ChatInputProps {
  inputMessage: string;
  setInputMessage: (message: string) => void;
  handleSendMessage: (metadata?: {
    toolCalls?: string[];
    urls?: string[];
    contextNotes?: TFile[];
    contextFolders?: string[];
  }) => void;
  isGenerating: boolean;
  onStopGenerating: () => void;
  app: App;
  contextNotes: TFile[];
  setContextNotes: React.Dispatch<React.SetStateAction<TFile[]>>;
  includeActiveNote: boolean;
  setIncludeActiveNote: (include: boolean) => void;
  selectedImages: File[];
  onAddImage: (files: File[]) => void;
  setSelectedImages: React.Dispatch<React.SetStateAction<File[]>>;
  disableModelSwitch?: boolean;
  onNewChat?: () => void;
  onSaveAsNote?: () => void;
  onLoadHistory?: () => void;
  chatHistory?: ChatHistoryItem[];
  onUpdateChatTitle?: (id: string, newTitle: string) => Promise<void>;
  onDeleteChat?: (id: string) => Promise<void>;
  onLoadChat?: (id: string) => Promise<void>;
  onOpenSourceFile?: (id: string) => Promise<void>;
  onModeChange?: (mode: ChainType) => void;
  onCloseProject?: () => void;
  latestTokenCount?: number | null;

  // Edit mode props
  editMode?: boolean;
  onEditSave?: (
    text: string,
    context: {
      notes: TFile[];
      urls: string[];
      folders: string[];
    }
  ) => void;
  onEditCancel?: () => void;
  initialContext?: {
    notes?: TFile[];
    urls?: string[];
    folders?: string[];
  };
}

const ChatInput: React.FC<ChatInputProps> = ({
  inputMessage,
  setInputMessage,
  handleSendMessage,
  isGenerating,
  onStopGenerating,
  app,
  contextNotes,
  setContextNotes,
  includeActiveNote,
  setIncludeActiveNote,
  selectedImages,
  onAddImage,
  setSelectedImages,
  disableModelSwitch,
  onNewChat,
  onSaveAsNote,
  onLoadHistory,
  chatHistory,
  onUpdateChatTitle,
  onDeleteChat,
  onLoadChat,
  onOpenSourceFile,
  onModeChange,
  onCloseProject,
  latestTokenCount,
  editMode = false,
  onEditSave,
  onEditCancel,
  initialContext,
}) => {
  const [contextUrls, setContextUrls] = useState<string[]>(initialContext?.urls || []);
  const [contextFolders, setContextFolders] = useState<string[]>(initialContext?.folders || []);
  const containerRef = useRef<HTMLDivElement>(null);
  const lexicalEditorRef = useRef<any>(null);
  const [currentModelKey, setCurrentModelKey] = useModelKey();
  const [currentChain, setCurrentChain] = useChainType();
  const [isProjectLoading] = useProjectLoading();
  const settings = useSettingsValue();
  const isPlusUser = useIsPlusUser();
  const currentActiveNote = useWorkspaceActiveFile();
  const [selectedProject, setSelectedProject] = useState<ProjectConfig | null>(null);
  const [notesFromPills, setNotesFromPills] = useState<{ path: string; basename: string }[]>([]);
  const [urlsFromPills, setUrlsFromPills] = useState<string[]>([]);
  const [foldersFromPills, setFoldersFromPills] = useState<string[]>([]);
  const [toolsFromPills, setToolsFromPills] = useState<string[]>([]);
  const isCopilotPlus = isPlusChain(currentChain);
  const showAutonomousAgent = isCopilotPlus && currentChain !== ChainType.PROJECT_CHAIN;

  // Toggle states for vault, web search, composer, and autonomous agent
  const [vaultToggle, setVaultToggle] = useState(false);
  const [webToggle, setWebToggle] = useState(false);
  const [composerToggle, setComposerToggle] = useState(false);
  const [autonomousAgentToggle, setAutonomousAgentToggle] = useState(
    settings.enableAutonomousAgent
  );
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const loadingMessages = [
    "Loading the project context...",
    "Processing context files...",
    "If you have many files in context, this can take a while...",
  ];
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Sync autonomous agent toggle with settings and chain type
  useEffect(() => {
    if (currentChain === ChainType.PROJECT_CHAIN) {
      // Force off in Projects mode
      setAutonomousAgentToggle(false);
    } else {
      // In other modes, use the actual settings value
      setAutonomousAgentToggle(settings.enableAutonomousAgent);
    }
  }, [settings.enableAutonomousAgent, currentChain]);

  useEffect(() => {
    if (currentChain === ChainType.PROJECT_CHAIN) {
      setSelectedProject(getCurrentProject());

      const unsubscribe = subscribeToProjectChange((project) => {
        setSelectedProject(project);
      });

      return () => {
        unsubscribe();
      };
    } else {
      setSelectedProject(null);
    }
  }, [currentChain]);

  useEffect(() => {
    if (!isProjectLoading) return;

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isProjectLoading, loadingMessages.length]);

  const getDisplayModelKey = (): string => {
    if (
      selectedProject &&
      currentChain === ChainType.PROJECT_CHAIN &&
      selectedProject.projectModelKey
    ) {
      return selectedProject.projectModelKey;
    }
    return currentModelKey;
  };
  const displayModelKey = getDisplayModelKey();
  const currentModel = settings.activeModels.find(
    (model) => model.enabled && getModelKeyFromModel(model) === displayModelKey
  );
  const currentModelLabel = currentModel ? getModelDisplayText(currentModel) : "Select model";
  const canShowHistory = Boolean(onLoadHistory && chatHistory && onUpdateChatTitle && onDeleteChat);
  const showOptionsMenu = !editMode;
  const canSaveAsNote = Boolean(onSaveAsNote && !settings.autosaveChat);

  /**
   * Removes vault tool pills when vault search is toggled off.
   */
  const handleVaultToggleOff = useCallback(() => {
    if (lexicalEditorRef.current && isCopilotPlus) {
      lexicalEditorRef.current.update(() => {
        $removePillsByToolName("@vault");
      });
    }
  }, [isCopilotPlus]);

  /**
   * Removes web search tool pills when web search is toggled off.
   */
  const handleWebToggleOff = useCallback(() => {
    if (lexicalEditorRef.current && isCopilotPlus) {
      lexicalEditorRef.current.update(() => {
        $removePillsByToolName("@websearch");
        $removePillsByToolName("@web");
      });
    }
  }, [isCopilotPlus]);

  /**
   * Removes composer tool pills when composer is toggled off.
   */
  const handleComposerToggleOff = useCallback(() => {
    if (lexicalEditorRef.current && isCopilotPlus) {
      lexicalEditorRef.current.update(() => {
        $removePillsByToolName("@composer");
      });
    }
  }, [isCopilotPlus]);

  /**
   * Updates the chain selection and clears project state when leaving project mode.
   * @param chainType The chain type to select.
   */
  const handleModeSelect = useCallback(
    (chainType: ChainType) => {
      setCurrentChain(chainType);
      onModeChange?.(chainType);
      if (chainType !== ChainType.PROJECT_CHAIN) {
        setCurrentProject(null);
        onCloseProject?.();
      }
    },
    [onModeChange, onCloseProject, setCurrentChain]
  );

  /**
   * Opens the system chat options menu anchored to the trigger click.
   * @param event The click event from the menu trigger button.
   */
  const handleOpenOptionsMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const menu = new Menu();

      if (onNewChat) {
        menu.addItem((item) => {
          item.setTitle("New chat").onClick(() => onNewChat());
        });
      }

      if (canSaveAsNote) {
        menu.addItem((item) => {
          item.setTitle("Save chat as note").onClick(() => onSaveAsNote?.());
        });
      }

      if (canShowHistory) {
        menu.addItem((item) => {
          item.setTitle("Chat history").onClick(() => {
            onLoadHistory?.();
            setIsHistoryOpen(true);
          });
        });
      }

      menu.addItem((item) => {
        item.setTitle("Add image(s)").onClick(() => {
          new AddImageModal(app, onAddImage).open();
        });
      });

      if (latestTokenCount !== null && latestTokenCount !== undefined) {
        menu.addItem((item) => {
          item.setTitle(`Context used: ${latestTokenCount.toLocaleString()}`).setDisabled(true);
        });
      }

      menu.addSeparator();

      menu.addItem((item) => {
        item.setTitle("Mode");
        (item as any).setSubmenu();
        const submenu = (item as any).submenu;
        if (!submenu) {
          return;
        }

        submenu.addItem((subItem: any) => {
          subItem
            .setTitle("Chat (free)")
            .setChecked(currentChain === ChainType.LLM_CHAIN)
            .onClick(() => handleModeSelect(ChainType.LLM_CHAIN));
        });
        submenu.addItem((subItem: any) => {
          subItem
            .setTitle("Vault QA (free)")
            .setChecked(currentChain === ChainType.VAULT_QA_CHAIN)
            .onClick(() => handleModeSelect(ChainType.VAULT_QA_CHAIN));
        });

        if (isPlusUser) {
          submenu.addItem((subItem: any) => {
            subItem
              .setTitle("Copilot Plus")
              .setChecked(currentChain === ChainType.COPILOT_PLUS_CHAIN)
              .onClick(() => handleModeSelect(ChainType.COPILOT_PLUS_CHAIN));
          });
          submenu.addItem((subItem: any) => {
            subItem
              .setTitle("Projects (alpha)")
              .setChecked(currentChain === ChainType.PROJECT_CHAIN)
              .onClick(() => handleModeSelect(ChainType.PROJECT_CHAIN));
          });
        } else {
          submenu.addItem((subItem: any) => {
            subItem.setTitle("Copilot Plus").onClick(() => {
              navigateToPlusPage(PLUS_UTM_MEDIUMS.CHAT_MODE_SELECT);
              onCloseProject?.();
            });
          });
          submenu.addItem((subItem: any) => {
            subItem.setTitle("Projects (alpha)").onClick(() => {
              navigateToPlusPage(PLUS_UTM_MEDIUMS.CHAT_MODE_SELECT);
              onCloseProject?.();
            });
          });
        }
      });

      menu.addItem((item) => {
        item.setTitle(`Model: ${currentModelLabel}`);

        if (disableModelSwitch) {
          item.setDisabled(true);
          return;
        }

        (item as any).setSubmenu();
        const submenu = (item as any).submenu;
        if (!submenu) {
          return;
        }

        settings.activeModels
          .filter((model) => model.enabled)
          .forEach((model) => {
            const { hasApiKey, errorNotice } = checkModelApiKey(model, settings);
            const modelKey = getModelKeyFromModel(model);
            submenu.addItem((subItem: any) => {
              subItem
                .setTitle(getModelDisplayText(model))
                .setChecked(modelKey === displayModelKey)
                .setDisabled(!hasApiKey)
                .onClick(() => {
                  if (!hasApiKey) {
                    if (errorNotice) {
                      new Notice(errorNotice);
                    }
                    return;
                  }
                  if (currentChain !== ChainType.PROJECT_CHAIN) {
                    setCurrentModelKey(modelKey);
                  }
                });
            });
          });
      });

      if (isCopilotPlus) {
        menu.addSeparator();

        if (showAutonomousAgent) {
          menu.addItem((item) => {
            item
              .setTitle("Autonomous agent")
              .setChecked(autonomousAgentToggle)
              .onClick(() => {
                const isEnabled = !autonomousAgentToggle;
                setAutonomousAgentToggle(isEnabled);
                updateSetting("enableAutonomousAgent", isEnabled);
              });
          });
        }

        menu.addItem((item) => {
          item
            .setTitle("Vault search")
            .setChecked(vaultToggle)
            .setDisabled(autonomousAgentToggle)
            .onClick(() => {
              const isEnabled = !vaultToggle;
              setVaultToggle(isEnabled);
              if (!isEnabled) {
                handleVaultToggleOff();
              }
            });
        });
        menu.addItem((item) => {
          item
            .setTitle("Web search")
            .setChecked(webToggle)
            .setDisabled(autonomousAgentToggle)
            .onClick(() => {
              const isEnabled = !webToggle;
              setWebToggle(isEnabled);
              if (!isEnabled) {
                handleWebToggleOff();
              }
            });
        });
        menu.addItem((item) => {
          item
            .setTitle("Composer")
            .setChecked(composerToggle)
            .setDisabled(autonomousAgentToggle)
            .onClick(() => {
              const isEnabled = !composerToggle;
              setComposerToggle(isEnabled);
              if (!isEnabled) {
                handleComposerToggleOff();
              }
            });
        });
      }

      menu.addSeparator();
      menu.addItem((item) => {
        item
          .setTitle("Suggested prompts")
          .setChecked(settings.showSuggestedPrompts)
          .onClick(() => updateSetting("showSuggestedPrompts", !settings.showSuggestedPrompts));
      });
      menu.addItem((item) => {
        item
          .setTitle("Relevant notes")
          .setChecked(settings.showRelevantNotes)
          .onClick(() => updateSetting("showRelevantNotes", !settings.showRelevantNotes));
      });

      menu.addSeparator();
      if (currentChain === ChainType.PROJECT_CHAIN) {
        menu.addItem((item) => {
          item.setTitle("Reload current project").onClick(() => reloadCurrentProject());
        });
        menu.addItem((item) => {
          item.setTitle("Force rebuild context").onClick(() => forceRebuildCurrentProjectContext());
        });
      } else {
        menu.addItem((item) => {
          item.setTitle("Refresh vault index").onClick(() => refreshVaultIndex());
        });
        menu.addItem((item) => {
          item.setTitle("Force reindex vault").onClick(() => {
            const modal = new ConfirmModal(
              app,
              () => forceReindexVault(),
              "This will delete and rebuild your entire vault index from scratch. This operation cannot be undone. Are you sure you want to proceed?",
              "Force Reindex Vault"
            );
            modal.open();
          });
        });
      }

      menu.showAtMouseEvent(event.nativeEvent);
    },
    [
      app,
      canSaveAsNote,
      canShowHistory,
      autonomousAgentToggle,
      composerToggle,
      currentChain,
      currentModelLabel,
      disableModelSwitch,
      displayModelKey,
      handleComposerToggleOff,
      handleModeSelect,
      handleVaultToggleOff,
      handleWebToggleOff,
      isCopilotPlus,
      isPlusUser,
      latestTokenCount,
      onAddImage,
      onCloseProject,
      onLoadHistory,
      onNewChat,
      onSaveAsNote,
      setAutonomousAgentToggle,
      setComposerToggle,
      setCurrentModelKey,
      setIsHistoryOpen,
      setVaultToggle,
      setWebToggle,
      settings,
      showAutonomousAgent,
      vaultToggle,
      webToggle,
    ]
  );

  const onSendMessage = () => {
    // Handle edit mode
    if (editMode && onEditSave) {
      onEditSave(inputMessage, {
        notes: contextNotes,
        urls: contextUrls,
        folders: contextFolders,
      });
      return;
    }

    if (!isCopilotPlus) {
      handleSendMessage();
      return;
    }

    // Build tool calls based on toggle states
    const toolCalls: string[] = [];
    // Only add tool calls when autonomous agent is off
    // When autonomous agent is on, it handles all tools internally
    if (!autonomousAgentToggle) {
      const messageLower = inputMessage.toLowerCase();

      // Only add tools from buttons if they're not already in the message
      if (vaultToggle && !messageLower.includes("@vault")) {
        toolCalls.push("@vault");
      }
      if (webToggle && !messageLower.includes("@websearch") && !messageLower.includes("@web")) {
        toolCalls.push("@websearch");
      }
      if (composerToggle && !messageLower.includes("@composer")) {
        toolCalls.push("@composer");
      }
    }

    handleSendMessage({
      toolCalls,
      contextNotes,
      urls: contextUrls,
      contextFolders,
    });
  };

  // Handle when pills are removed from the editor
  const handleNotePillsRemoved = (removedNotes: { path: string; basename: string }[]) => {
    const removedPaths = new Set(removedNotes.map((note) => note.path));

    setContextNotes((prev) => {
      return prev.filter((contextNote) => {
        // Remove any note whose pill was removed
        return !removedPaths.has(contextNote.path);
      });
    });
  };

  // Handle when URLs are removed from pills (when pills are deleted in editor)
  const handleURLPillsRemoved = (removedUrls: string[]) => {
    const removedUrlSet = new Set(removedUrls);

    setContextUrls((prev) => {
      return prev.filter((url) => {
        if (removedUrlSet.has(url)) {
          return false;
        }
        return true;
      });
    });
  };

  // Handle when tools are removed from pills (when pills are deleted in editor)
  const handleToolPillsRemoved = (removedTools: string[]) => {
    if (!isCopilotPlus || autonomousAgentToggle) return;

    // Update tool button states based on removed pills
    removedTools.forEach((tool) => {
      switch (tool) {
        case "@vault":
          setVaultToggle(false);
          break;
        case "@websearch":
        case "@web":
          setWebToggle(false);
          break;
        case "@composer":
          setComposerToggle(false);
          break;
      }
    });
  };

  // Sync tool button states with tool pills
  useEffect(() => {
    if (!isCopilotPlus || autonomousAgentToggle) return;

    // Update button states based on current tool pills
    const hasVault = toolsFromPills.includes("@vault");
    const hasWeb = toolsFromPills.includes("@websearch") || toolsFromPills.includes("@web");
    const hasComposer = toolsFromPills.includes("@composer");

    setVaultToggle(hasVault);
    setWebToggle(hasWeb);
    setComposerToggle(hasComposer);
  }, [toolsFromPills, isCopilotPlus, autonomousAgentToggle]);

  // Handle when folders are removed from pills (when pills are deleted in editor)
  const handleFolderPillsRemoved = (removedFolders: string[]) => {
    const removedFolderPaths = new Set(removedFolders);

    setContextFolders((prev) => {
      return prev.filter((folder) => {
        if (removedFolderPaths.has(folder)) {
          return false; // Remove this folder
        }
        return true; // Keep this folder
      });
    });
  };

  // Pill-to-context synchronization (when pills are added)
  useEffect(() => {
    setContextNotes((prev) => {
      const contextPaths = new Set(prev.map((note) => note.path));

      // Find notes that need to be added
      const newNotesFromPills = notesFromPills.filter((pillNote) => {
        // Only add if not already in context
        return !contextPaths.has(pillNote.path);
      });

      // Add completely new notes from pills
      const newFiles: TFile[] = [];
      newNotesFromPills.forEach((pillNote) => {
        const file = app.vault.getAbstractFileByPath(pillNote.path);
        if (file instanceof TFile) {
          newFiles.push(file);
        }
      });

      return [...prev, ...newFiles];
    });
  }, [notesFromPills, app.vault, setContextNotes]);

  // URL pill-to-context synchronization (when URL pills are added) - only for Plus chains
  useEffect(() => {
    if (isPlusChain(currentChain)) {
      setContextUrls((prev) => {
        const contextUrlSet = new Set(prev);

        // Find URLs that need to be added
        const newUrlsFromPills = urlsFromPills.filter((pillUrl) => {
          // Only add if not already in context
          return !contextUrlSet.has(pillUrl);
        });

        // Add completely new URLs from pills
        if (newUrlsFromPills.length > 0) {
          return Array.from(new Set([...prev, ...newUrlsFromPills]));
        }

        return prev;
      });
    } else {
      // Clear URLs for non-Plus chains
      setContextUrls([]);
    }
  }, [urlsFromPills, currentChain]);

  // Folder-to-context synchronization (when folders are added via pills)
  useEffect(() => {
    setContextFolders((prev) => {
      const contextFolderPaths = new Set(prev);

      // Find folders that need to be added
      const newFoldersFromPills = foldersFromPills.filter((pillFolder) => {
        // Only add if not already in context
        return !contextFolderPaths.has(pillFolder);
      });

      // Add completely new folders from pills
      return [...prev, ...newFoldersFromPills];
    });
  }, [foldersFromPills]);

  const onEditorReady = useCallback((editor: any) => {
    lexicalEditorRef.current = editor;
  }, []);

  // Handle Escape key for edit mode
  useEffect(() => {
    if (!editMode || !onEditCancel) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEditCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editMode, onEditCancel]);

  // Active note pill sync callbacks
  const handleActiveNoteAdded = useCallback(() => {
    setIncludeActiveNote(true);
  }, [setIncludeActiveNote]);

  const handleActiveNoteRemoved = useCallback(() => {
    setIncludeActiveNote(false);
  }, [setIncludeActiveNote]);

  // Handle tag selection from typeahead - auto-enable vault search
  const handleTagSelected = useCallback(() => {
    if (isCopilotPlus && !autonomousAgentToggle && !vaultToggle) {
      setVaultToggle(true);
      new Notice("Vault search enabled for tag query");
    }
  }, [isCopilotPlus, autonomousAgentToggle, vaultToggle]);

  return (
    <div
      className="tw-flex tw-w-full tw-flex-col tw-gap-0.5 tw-rounded-md tw-border tw-border-solid tw-border-border tw-p-1 tw-@container/chat-input"
      ref={containerRef}
    >
      {selectedImages.length > 0 && (
        <div className="selected-images">
          {selectedImages.map((file, index) => (
            <div key={index} className="image-preview-container">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="selected-image-preview"
              />
              <button
                className="remove-image-button"
                onClick={() => setSelectedImages((prev) => prev.filter((_, i) => i !== index))}
                title="Remove image"
              >
                <X className="tw-size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="tw-relative">
        {isProjectLoading && (
          <div className="tw-absolute tw-inset-0 tw-z-modal tw-flex tw-items-center tw-justify-center tw-bg-primary tw-opacity-80 tw-backdrop-blur-sm">
            <div className="tw-flex tw-items-center tw-gap-2">
              <Loader2 className="tw-size-4 tw-animate-spin" />
              <span className="tw-text-sm">{loadingMessages[loadingMessageIndex]}</span>
            </div>
          </div>
        )}
        {showOptionsMenu && canShowHistory && (
          <ChatHistoryPopover
            open={isHistoryOpen}
            onOpenChange={setIsHistoryOpen}
            chatHistory={chatHistory ?? []}
            onUpdateTitle={onUpdateChatTitle!}
            onDeleteChat={onDeleteChat!}
            onLoadChat={onLoadChat}
            onOpenSourceFile={onOpenSourceFile}
            anchorClassName="tw-absolute tw-right-2 tw-bottom-2"
          />
        )}
        <div className="tw-flex tw-items-end tw-gap-1">
          <LexicalEditor
            value={inputMessage}
            onChange={(value) => setInputMessage(value)}
            onSubmit={onSendMessage}
            onNotesChange={setNotesFromPills}
            onNotesRemoved={handleNotePillsRemoved}
            onActiveNoteAdded={handleActiveNoteAdded}
            onActiveNoteRemoved={handleActiveNoteRemoved}
            onURLsChange={isCopilotPlus ? setUrlsFromPills : undefined}
            onURLsRemoved={isCopilotPlus ? handleURLPillsRemoved : undefined}
            onToolsChange={isCopilotPlus ? setToolsFromPills : undefined}
            onToolsRemoved={isCopilotPlus ? handleToolPillsRemoved : undefined}
            onFoldersChange={setFoldersFromPills}
            onFoldersRemoved={handleFolderPillsRemoved}
            onEditorReady={onEditorReady}
            onImagePaste={onAddImage}
            onTagSelected={handleTagSelected}
            placeholder={"Ask about notes, @context, /prompts"}
            disabled={isProjectLoading}
            isCopilotPlus={isCopilotPlus}
            currentActiveFile={currentActiveNote}
            currentChain={currentChain}
            className="tw-min-w-0 tw-flex-1"
          />
          <div className="tw-flex tw-items-center tw-gap-1 tw-pb-1">
            {showOptionsMenu && (
              <Button
                variant="ghost2"
                size="icon"
                aria-label="Chat options"
                onClick={handleOpenOptionsMenu}
              >
                <MoreHorizontal className="tw-size-4" />
              </Button>
            )}
            {editMode && onEditCancel && (
              <Button
                variant="ghost2"
                size="icon"
                className="tw-text-muted"
                onClick={onEditCancel}
                aria-label="Cancel edit"
              >
                <X className="tw-size-4" />
              </Button>
            )}
            <Button
              variant="ghost2"
              size="icon"
              className="tw-text-normal"
              onClick={() => {
                if (isGenerating) {
                  onStopGenerating();
                  return;
                }
                onSendMessage();
              }}
              aria-label={
                isGenerating ? "Stop generating" : editMode ? "Save edit" : "Send message"
              }
            >
              {isGenerating ? (
                <StopCircle className="tw-size-4" />
              ) : (
                <ArrowUp className="tw-size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

ChatInput.displayName = "ChatInput";

export default ChatInput;
