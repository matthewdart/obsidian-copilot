// src/components/SourcesModal.tsx
import { App, Modal } from "obsidian";

export class SourcesModal extends Modal {
  sources: { title: string; path: string; score: number; explanation?: any }[];

  constructor(
    app: App,
    sources: { title: string; path: string; score: number; explanation?: any }[]
  ) {
    super(app);
    this.sources = sources;
  }

  /**
   * Opens the modal and renders the sources list.
   */
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Sources" });

    // Display all sources sorted by score (already sorted from chain)
    this.createSourceList(contentEl, this.sources);
  }

  /**
   * Builds the sources list UI.
   * @param container The container to render the list into.
   * @param sources The sources to display.
   */
  private createSourceList(
    container: HTMLElement,
    sources: { title: string; path: string; score: number; explanation?: any }[]
  ) {
    const list = container.createEl("ul", { cls: "tw-list-none tw-p-0" });

    sources.forEach((source) => {
      const item = list.createEl("li", { cls: "tw-mb-4" });

      // Create collapsible container
      const itemContainer = item.createDiv({ cls: "tw-cursor-pointer" });

      // Add expand/collapse indicator
      const expandIndicator = itemContainer.createSpan({
        cls: "tw-mr-2 tw-inline-block tw-w-4 tw-transition-transform tw-duration-200",
      });
      expandIndicator.textContent = source.explanation ? "▶" : "";

      // Display title, but show path in parentheses if there are duplicates
      const displayText =
        source.path && source.path !== source.title
          ? `${source.title} (${source.path})`
          : source.title;

      const link = itemContainer.createEl("a", {
        href: `obsidian://open?vault=${encodeURIComponent(this.app.vault.getName())}&file=${encodeURIComponent(source.path || source.title)}`,
        text: displayText,
      });
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Use the path if available, otherwise fall back to title
        this.app.workspace.openLinkText(source.path || source.title, "");
      });

      // Display with 4 decimals to match SearchCore logs and avoid apparent ties
      if (typeof source.score === "number") {
        itemContainer.appendChild(
          document.createTextNode(` - Relevance score: ${source.score.toFixed(4)}`)
        );
      }

      // Add explanation if available (initially hidden)
      let explanationDiv: HTMLElement | null = null;
      if (source.explanation) {
        explanationDiv = this.addExplanation(item, source.explanation);
        explanationDiv.addClass("tw-hidden"); // Initially collapsed

        // Toggle expansion on click
        itemContainer.addEventListener("click", (e) => {
          if (e.target === link) return; // Don't toggle when clicking the link

          if (explanationDiv) {
            const isExpanded = !explanationDiv.classList.contains("tw-hidden");
            explanationDiv.classList.toggle("tw-hidden", isExpanded);
            expandIndicator.classList.toggle("tw-rotate-90", !isExpanded);
          }
        });
      }
    });
  }

  /**
   * Creates the explanation block for a source.
   * @param container The container to render into.
   * @param explanation The explanation payload.
   * @returns The created explanation element.
   */
  private addExplanation(container: HTMLElement, explanation: any): HTMLElement {
    const explanationDiv = container.createDiv({
      cls: "tw-mt-2 tw-ml-10 tw-text-ui-small tw-text-muted tw-border-l tw-border-solid tw-border-border tw-pl-2",
    });

    const details: string[] = [];

    // Add lexical matches
    if (explanation.lexicalMatches && explanation.lexicalMatches.length > 0) {
      const fields = new Set(explanation.lexicalMatches.map((m: any) => m.field));
      const queries = new Set(explanation.lexicalMatches.map((m: any) => m.query));
      details.push(
        `Lexical: matched "${Array.from(queries).join('", "')}" in ${Array.from(fields).join(", ")}`
      );
    }

    // Add semantic score
    if (explanation.semanticScore !== undefined && explanation.semanticScore > 0) {
      details.push(`Semantic: ${(explanation.semanticScore * 100).toFixed(1)}% similarity`);
    }

    // Add folder boost
    if (explanation.folderBoost) {
      details.push(
        `Folder boost: ${explanation.folderBoost.boostFactor.toFixed(2)}x (${explanation.folderBoost.documentCount} docs in ${explanation.folderBoost.folder || "root"})`
      );
    }

    // Add graph connections (new query-aware boost)
    if (explanation.graphConnections) {
      const gc = explanation.graphConnections;
      const connectionParts = [];
      if (gc.backlinks > 0) connectionParts.push(`${gc.backlinks} backlinks`);
      if (gc.coCitations > 0) connectionParts.push(`${gc.coCitations} co-citations`);
      if (gc.sharedTags > 0) connectionParts.push(`${gc.sharedTags} shared tags`);

      if (connectionParts.length > 0) {
        details.push(
          `Graph connections: ${gc.score.toFixed(1)} score (${connectionParts.join(", ")})`
        );
      }
    }

    // Add old graph boost (if still present for backwards compatibility)
    if (explanation.graphBoost && !explanation.graphConnections) {
      details.push(
        `Graph boost: ${explanation.graphBoost.boostFactor.toFixed(2)}x (${explanation.graphBoost.connections} connections)`
      );
    }

    // Add base vs final score if boosted
    if (explanation.baseScore !== explanation.finalScore) {
      details.push(
        `Score: ${explanation.baseScore.toFixed(4)} → ${explanation.finalScore.toFixed(4)}`
      );
    }

    // Create explanation text without "Why this ranked here:" header
    if (details.length > 0) {
      details.forEach((detail) => {
        const detailDiv = explanationDiv.createEl("div", { cls: "tw-mb-1" });
        detailDiv.textContent = `• ${detail}`;
      });
    }

    return explanationDiv;
  }

  /**
   * Clears the modal content on close.
   */
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
