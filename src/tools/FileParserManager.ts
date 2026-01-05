import { ExternalServicesClient } from "@/LLMProviders/externalServicesClient";
import { ProjectConfig } from "@/aiParams";
import { PDFCache } from "@/cache/pdfCache";
import { ProjectContextCache } from "@/cache/projectContextCache";
import { logError, logInfo } from "@/logger";
import { extractRetryTime, isRateLimitError } from "@/utils/rateLimitUtils";
import { MarkdownView, Notice, TFile, Vault } from "obsidian";
import { CanvasLoader } from "./CanvasLoader";

interface FileParser {
  supportedExtensions: string[];
  parseFile: (file: TFile, vault: Vault) => Promise<string>;
}

export class MarkdownParser implements FileParser {
  supportedExtensions = ["md"];

  /**
   * Parse markdown file content, preferring the open editor buffer.
   *
   * @param file - Markdown file to parse.
   * @param vault - Vault instance for file reads.
   * @returns Parsed markdown content.
   */
  async parseFile(file: TFile, vault: Vault): Promise<string> {
    const openViewText = readOpenMarkdownViewText(file);
    if (openViewText !== null) {
      return openViewText;
    }

    try {
      const cachedText = await vault.cachedRead(file);
      if (cachedText.length > 0 || file.stat?.size === 0) {
        return cachedText;
      }

      return await vault.read(file);
    } catch (error) {
      logError(`MarkdownParser: failed to read ${file.path}`, error);
      try {
        return await vault.read(file);
      } catch (fallbackError) {
        logError(`MarkdownParser: fallback read failed for ${file.path}`, fallbackError);
        return "";
      }
    }
  }
}

/**
 * Returns the live editor content for an open markdown file.
 *
 * @param file - Markdown file to locate in open views.
 * @returns The current editor content, or null when the note is not open.
 */
function readOpenMarkdownViewText(file: TFile): string | null {
  if (!app?.workspace?.getLeavesOfType || typeof MarkdownView === "undefined") {
    return null;
  }

  const leaves = app.workspace.getLeavesOfType("markdown");
  for (const leaf of leaves) {
    const view = leaf.view;
    if (view instanceof MarkdownView && view.file?.path === file.path) {
      return view.getViewData();
    }
  }

  return null;
}

export class PDFParser implements FileParser {
  supportedExtensions = ["pdf"];
  private externalServicesClient: ExternalServicesClient;
  private pdfCache: PDFCache;

  constructor(externalServicesClient: ExternalServicesClient) {
    this.externalServicesClient = externalServicesClient;
    this.pdfCache = PDFCache.getInstance();
  }

  async parseFile(file: TFile, vault: Vault): Promise<string> {
    try {
      logInfo("Parsing PDF file:", file.path);

      // Try to get from cache first
      const cachedResponse = await this.pdfCache.get(file);
      if (cachedResponse) {
        logInfo("Using cached PDF content for:", file.path);
        return cachedResponse.response;
      }

      // If not in cache, read the file and call the API
      const binaryContent = await vault.readBinary(file);
      logInfo("Parsing PDF content locally for:", file.path);
      const pdf4llmResponse = await this.externalServicesClient.pdf4llm(binaryContent);
      await this.pdfCache.set(file, pdf4llmResponse);
      return pdf4llmResponse.response;
    } catch (error) {
      logError(`Error extracting content from PDF ${file.path}:`, error);
      return `[Error: Could not extract content from PDF ${file.basename}]`;
    }
  }

  async clearCache(): Promise<void> {
    logInfo("Clearing PDF cache");
    await this.pdfCache.clear();
  }
}

export class CanvasParser implements FileParser {
  supportedExtensions = ["canvas"];

  async parseFile(file: TFile, vault: Vault): Promise<string> {
    try {
      logInfo("Parsing Canvas file:", file.path);
      const canvasLoader = new CanvasLoader(vault);
      const canvasData = await canvasLoader.load(file);

      // Use the specialized buildPrompt method to create LLM-friendly format
      return canvasLoader.buildPrompt(canvasData);
    } catch (error) {
      logError(`Error parsing Canvas file ${file.path}:`, error);
      return `[Error: Could not parse Canvas file ${file.basename}]`;
    }
  }
}

export class Docs4LLMParser implements FileParser {
  // Support various document and media file types
  supportedExtensions = ["pdf", "docx", "txt", "md", "html", "htm", "csv", "json"];
  private externalServicesClient: ExternalServicesClient;
  private projectContextCache: ProjectContextCache;
  private currentProject: ProjectConfig | null;
  private static lastRateLimitNoticeTime: number = 0;

  public static resetRateLimitNoticeTimer(): void {
    Docs4LLMParser.lastRateLimitNoticeTime = 0;
  }

  constructor(
    externalServicesClient: ExternalServicesClient,
    project: ProjectConfig | null = null
  ) {
    this.externalServicesClient = externalServicesClient;
    this.projectContextCache = ProjectContextCache.getInstance();
    this.currentProject = project;
  }

  async parseFile(file: TFile, vault: Vault): Promise<string> {
    try {
      const projectLabel = this.currentProject
        ? `Project ${this.currentProject.name}`
        : "No project context";
      const shouldUseCache = Boolean(this.currentProject);

      logInfo(`[Docs4LLMParser] ${projectLabel}: Parsing ${file.extension} file: ${file.path}`);

      if (shouldUseCache && this.currentProject) {
        const cachedContent = await this.projectContextCache.getOrReuseFileContext(
          this.currentProject,
          file.path
        );
        if (cachedContent) {
          logInfo(`[Docs4LLMParser] ${projectLabel}: Using cached content for: ${file.path}`);
          return cachedContent;
        }
        logInfo(
          `[Docs4LLMParser] ${projectLabel}: Cache miss for: ${file.path}. Proceeding to API call.`
        );
      }

      const binaryContent = await vault.readBinary(file);

      logInfo(`[Docs4LLMParser] ${projectLabel}: Parsing document content for: ${file.path}`);
      const docs4llmResponse = await this.externalServicesClient.docs4llm(
        binaryContent,
        file.extension
      );

      const response = docs4llmResponse?.response;
      if (!response) {
        throw new Error("Empty response from docs4llm API");
      }

      // Extract markdown content from response
      let content = "";
      if (typeof response === "string") {
        content = response;
      } else if (Array.isArray(response)) {
        // Handle array of documents from docs4llm
        const markdownParts: string[] = [];
        for (const doc of response) {
          const docContent = (doc as any)?.content;
          if (docContent) {
            // Prioritize markdown content, then fallback to text content
            if (docContent.md) {
              markdownParts.push(docContent.md as string);
            } else if (docContent.text) {
              markdownParts.push(docContent.text as string);
            }
          }
        }
        content = markdownParts.join("\n\n");
      } else if (typeof response === "object") {
        // Handle single object response (backward compatibility)
        const objResponse = response as any;
        if (objResponse.md) {
          content = objResponse.md as string;
        } else if (objResponse.text) {
          content = objResponse.text as string;
        } else if (objResponse.content) {
          content = objResponse.content as string;
        } else {
          // If no markdown/text/content field, stringify the entire response
          content = JSON.stringify(objResponse, null, 2);
        }
      } else {
        content = String(response);
      }

      // Cache the converted content
      if (shouldUseCache && this.currentProject) {
        await this.projectContextCache.setFileContext(this.currentProject, file.path, content);
        logInfo(
          `[Docs4LLMParser] ${projectLabel}: Successfully processed and cached: ${file.path}`
        );
      } else {
        logInfo(`[Docs4LLMParser] ${projectLabel}: Successfully processed: ${file.path}`);
      }
      return content;
    } catch (error) {
      const projectLabel = this.currentProject
        ? `Project ${this.currentProject.name}`
        : "No project context";
      logError(`[Docs4LLMParser] ${projectLabel}: Error processing file ${file.path}:`, error);

      // Check if this is a rate limit error and show user-friendly notice
      if (isRateLimitError(error)) {
        this.showRateLimitNotice(error);
      }

      throw error; // Propagate the error up
    }
  }

  private showRateLimitNotice(error: any): void {
    const now = Date.now();

    // Only show one rate limit notice per minute to avoid spam
    if (now - Docs4LLMParser.lastRateLimitNoticeTime < 60000) {
      return;
    }

    Docs4LLMParser.lastRateLimitNoticeTime = now;

    const retryTime = extractRetryTime(error);

    new Notice(
      `⚠️ Rate limit exceeded for document processing. Please try again in ${retryTime}. Having fewer non-markdown files in the project will help.`,
      10000 // Show notice for 10 seconds
    );
  }

  async clearCache(): Promise<void> {
    // This method is no longer needed as cache clearing is handled at the project level
    logInfo("Cache clearing is now handled at the project level");
  }
}

// Future parsers can be added like this:
/*
class DocxParser implements FileParser {
  supportedExtensions = ["docx", "doc"];

  async parseFile(file: TFile, vault: Vault): Promise<string> {
    // Implementation for Word documents
  }
}
*/

export class FileParserManager {
  private parsers: Map<string, FileParser> = new Map();
  private isProjectMode: boolean;
  private currentProject: ProjectConfig | null;

  constructor(
    externalServicesClient: ExternalServicesClient,
    _vault: Vault,
    isProjectMode: boolean = false,
    project: ProjectConfig | null = null
  ) {
    this.isProjectMode = isProjectMode;
    this.currentProject = project;

    // Register parsers
    this.registerParser(new MarkdownParser());

    // In project mode, use Docs4LLMParser for all supported files including PDFs
    this.registerParser(new Docs4LLMParser(externalServicesClient, project));

    // Only register PDFParser when not in project mode
    if (!isProjectMode) {
      this.registerParser(new PDFParser(externalServicesClient));
    }

    this.registerParser(new CanvasParser());
  }

  registerParser(parser: FileParser) {
    for (const ext of parser.supportedExtensions) {
      this.parsers.set(ext, parser);
    }
  }

  async parseFile(file: TFile, vault: Vault): Promise<string> {
    const parser = this.parsers.get(file.extension);
    if (!parser) {
      throw new Error(`No parser found for file type: ${file.extension}`);
    }
    return await parser.parseFile(file, vault);
  }

  supportsExtension(extension: string): boolean {
    return this.parsers.has(extension);
  }

  async clearPDFCache(): Promise<void> {
    const pdfParser = this.parsers.get("pdf");
    if (pdfParser instanceof PDFParser) {
      await pdfParser.clearCache();
    }
  }
}
