# TODO - Technical Debt & Future Improvements

This document tracks technical debt items and improvements that need to be addressed in the future.

## 1. Docs4LLM SSL Error in Projects Mode

### Issue Description

Document parsing previously failed with SSL errors when uploading to the Brevilabs docs4llm endpoint. Brevilabs services have been removed; parsing now relies on local extraction (`pdfjs-dist`, `mammoth`) and open providers.

### Technical Details

- Parsing logic lives in `src/LLMProviders/externalServicesClient.ts` and `src/tools/FileParserManager.ts`.
- Coverage is intentionally limited to common types (pdf, docx, html, txt/csv/json); unsupported formats return readable errors.

### Why Current Approaches Won't Work

1. No remote conversion service is available; relying on Brevilabs endpoints is deprecated.
2. Some binary formats still need richer parsing support beyond the current local adapters.

### Recommended Solution

1. Expand local parsers over time (e.g., add lightweight handlers for PPT/Excel/RTF) without reintroducing closed endpoints.
2. Gate large files with clear messaging and graceful degradation to avoid blocking project context loads.

---

_Last updated: 2025-07-18_
