/* eslint-disable @typescript-eslint/no-explicit-any */
import { logError } from "@/logger";

export interface Url4llmResponse {
  response: string;
  elapsed_time_ms: number;
}

export interface Pdf4llmResponse {
  response: string;
  elapsed_time_ms: number;
}

export interface Docs4llmResponse {
  response: unknown;
  elapsed_time_ms: number;
}

export interface WebSearchResponse {
  response: {
    choices: [
      {
        message: {
          content: string;
        };
      },
    ];
    citations: string[];
  };
  elapsed_time_ms: number;
}

export interface Youtube4llmResponse {
  response: {
    transcript: string;
  };
  elapsed_time_ms: number;
}

/**
 * ExternalServicesClient centralizes integrations that were previously handled by Brevilabs.
 * All methods rely on open providers (DuckDuckGo, public transcript endpoints, local parsing).
 */
export class ExternalServicesClient {
  private static instance: ExternalServicesClient;

  private constructor() {}

  /**
   * Retrieve the singleton instance.
   */
  static getInstance(): ExternalServicesClient {
    if (!ExternalServicesClient.instance) {
      ExternalServicesClient.instance = new ExternalServicesClient();
    }
    return ExternalServicesClient.instance;
  }

  /**
   * Perform a lightweight web search using DuckDuckGo's public API.
   */
  async webSearch(query: string): Promise<WebSearchResponse> {
    const start = this.getTimestamp();
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=0`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`DuckDuckGo request failed with status ${response.status}`);
      }

      const data = await response.json();
      const flattenedTopics = this.flattenDuckDuckGoTopics(data.RelatedTopics || []);

      const results = [
        ...(data.AbstractText
          ? [
              {
                title: data.Heading || "Summary",
                text: data.AbstractText as string,
                url: data.AbstractURL as string,
              },
            ]
          : []),
        ...flattenedTopics,
      ].slice(0, 5);

      const citations = results.map((item) => item.url).filter(Boolean) as string[];
      const message =
        results.length === 0
          ? "No results found."
          : results
              .map((item, index) => {
                const title = item.title || `Result ${index + 1}`;
                const description = item.text || "";
                const link = item.url ? `\nSource: ${item.url}` : "";
                return `${index + 1}. ${title}\n${description}${link}`;
              })
              .join("\n\n");

      return {
        response: {
          choices: [{ message: { content: message } }],
          citations,
        },
        elapsed_time_ms: this.getTimestamp() - start,
      };
    } catch (error) {
      logError("Web search failed", error);
      return {
        response: {
          choices: [{ message: { content: "Web search failed to return results." } }],
          citations: [],
        },
        elapsed_time_ms: this.getTimestamp() - start,
      };
    }
  }

  /**
   * Convert a URL into text content by fetching and parsing HTML or plain text responses.
   */
  async url4llm(url: string): Promise<Url4llmResponse> {
    const start = this.getTimestamp();
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`URL fetch failed with status ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      let content = "";

      if (contentType.includes("application/pdf")) {
        const binary = await response.arrayBuffer();
        const parsed = await this.pdf4llm(binary);
        content = parsed.response;
      } else if (contentType.includes("text/html")) {
        const html = await response.text();
        content = this.htmlToText(html);
      } else {
        content = await response.text();
      }

      return {
        response: content,
        elapsed_time_ms: this.getTimestamp() - start,
      };
    } catch (error) {
      logError(`Failed to process URL ${url}`, error);
      return {
        response: "",
        elapsed_time_ms: this.getTimestamp() - start,
      };
    }
  }

  /**
   * Extract text content from a PDF buffer using pdfjs-dist (worker disabled for bundling).
   */
  async pdf4llm(binaryContent: ArrayBuffer): Promise<Pdf4llmResponse> {
    const start = this.getTimestamp();

    try {
      const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf");
      const loadingTask = pdfjsLib.getDocument({
        data: binaryContent,
        disableFontFace: true,
        disableRange: true,
        disableStream: true,
        useSystemFonts: true,
        isEvalSupported: false,
        disableWorker: true,
      });

      const pdf = await loadingTask.promise;
      let combinedText = "";

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => ("str" in item ? item.str : ""))
          .join(" ");
        combinedText += `${pageText}\n\n`;
      }

      return {
        response: combinedText.trim(),
        elapsed_time_ms: this.getTimestamp() - start,
      };
    } catch (error) {
      logError("Failed to parse PDF content", error);
      return {
        response: "",
        elapsed_time_ms: this.getTimestamp() - start,
      };
    }
  }

  /**
   * Extract readable text content from common document types.
   */
  async docs4llm(binaryContent: ArrayBuffer, fileType: string): Promise<Docs4llmResponse> {
    const start = this.getTimestamp();
    const normalizedExtension = fileType.toLowerCase();

    try {
      if (normalizedExtension === "pdf") {
        return await this.pdf4llm(binaryContent);
      }

      if (normalizedExtension === "docx") {
        const mammothModule = await import("mammoth");
        const convertToHtml =
          (mammothModule as any).convertToHtml || (mammothModule as any).default?.convertToHtml;
        if (!convertToHtml) {
          throw new Error("mammoth.convertToHtml is not available");
        }
        const { value } = await convertToHtml({ arrayBuffer: binaryContent });
        return {
          response: this.htmlToText(value),
          elapsed_time_ms: this.getTimestamp() - start,
        };
      }

      if (normalizedExtension === "html" || normalizedExtension === "htm") {
        const decoded = this.decodeToText(binaryContent);
        return {
          response: this.htmlToText(decoded),
          elapsed_time_ms: this.getTimestamp() - start,
        };
      }

      return {
        response: this.decodeToText(binaryContent),
        elapsed_time_ms: this.getTimestamp() - start,
      };
    } catch (error) {
      logError(`Failed to parse document of type ${fileType}`, error);
      return {
        response: "",
        elapsed_time_ms: this.getTimestamp() - start,
      };
    }
  }

  /**
   * Fetch a YouTube transcript using a public endpoint.
   */
  async youtube4llm(url: string): Promise<Youtube4llmResponse> {
    const start = this.getTimestamp();
    try {
      const videoId = this.extractYouTubeId(url);
      if (!videoId) {
        throw new Error("Could not parse YouTube video ID");
      }

      const endpoint = `https://youtubetranscript.com/?format=json&lang=en&video_id=${encodeURIComponent(videoId)}`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Transcript request failed with status ${response.status}`);
      }

      const data = await response.json();
      const transcript = Array.isArray(data)
        ? data.map((entry: { text: string }) => entry.text).join(" ")
        : data.text || "";

      return {
        response: { transcript },
        elapsed_time_ms: this.getTimestamp() - start,
      };
    } catch (error) {
      logError(`Failed to fetch YouTube transcript for ${url}`, error);
      return {
        response: { transcript: "" },
        elapsed_time_ms: this.getTimestamp() - start,
      };
    }
  }

  /**
   * Decode an ArrayBuffer into UTF-8 text.
   */
  private decodeToText(binaryContent: ArrayBuffer): string {
    try {
      return new TextDecoder("utf-8").decode(binaryContent);
    } catch (error) {
      logError("Failed to decode text content", error);
      return "";
    }
  }

  /**
   * Convert HTML into compact text by stripping tags and collapsing whitespace.
   */
  private htmlToText(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const textContent = doc.body?.textContent || "";
    return textContent.replace(/\s+/g, " ").trim();
  }

  /**
   * Flatten DuckDuckGo related topics into a simple array of results.
   */
  private flattenDuckDuckGoTopics(
    topics: Array<any>
  ): Array<{ title: string; text: string; url?: string }> {
    const results: Array<{ title: string; text: string; url?: string }> = [];

    topics.forEach((topic) => {
      if (topic.Topics && Array.isArray(topic.Topics)) {
        results.push(...this.flattenDuckDuckGoTopics(topic.Topics));
        return;
      }

      if (topic.Text) {
        results.push({
          title: topic.FirstURL || topic.Text,
          text: topic.Text,
          url: topic.FirstURL,
        });
      }
    });

    return results;
  }

  /**
   * Extract a YouTube video ID from common URL formats.
   */
  private extractYouTubeId(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (parsed.searchParams.get("v")) {
        return parsed.searchParams.get("v");
      }
      const match = parsed.pathname.match(/\/(?:embed\/|shorts\/|watch\/)?([\w-]{11})/);
      return match ? match[1] : null;
    } catch (error) {
      logError("Failed to parse YouTube URL", error);
      return null;
    }
  }

  /**
   * Provide a monotonic timestamp compatible with browser and Node environments.
   */
  private getTimestamp(): number {
    if (typeof performance !== "undefined" && performance.now) {
      return performance.now();
    }
    return Date.now();
  }
}
