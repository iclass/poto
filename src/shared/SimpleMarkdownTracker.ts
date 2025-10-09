// Simplified markdown state tracker focused on the most important cases
// This approach is more reliable and easier to understand

export type SimpleMdState = {
    inFence: boolean;
    fenceChar: "`" | "~" | null;
    fenceLen: number;
    inYamlFrontmatter: boolean;
    lastNonEmptyLine: string | null;
    buffer: string;
};

export function createSimpleMdState(): SimpleMdState {
    return {
        inFence: false,
        fenceChar: null,
        fenceLen: 0,
        inYamlFrontmatter: false,
        lastNonEmptyLine: null,
        buffer: "",
    };
}

export function feedChunkSimple(state: SimpleMdState, chunk: string): void {
    const text = chunk.replace(/\r\n?/g, "\n");
    state.buffer += text;

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // YAML front matter detection
        if (line.trim() === "---" && state.buffer.trimStart().startsWith("---")) {
            if (!state.inYamlFrontmatter) {
                state.inYamlFrontmatter = true;
            } else {
                state.inYamlFrontmatter = false;
            }
        }

        // Fenced code block handling
        const fence = line.match(/^\s*([`~]{3,})([\w-+.]*)\s*$/);
        if (fence) {
            const char = fence[1][0] as "`" | "~";
            const len = fence[1].length;
            if (!state.inFence) {
                state.inFence = true;
                state.fenceChar = char;
                state.fenceLen = len;
            } else if (char === state.fenceChar && len >= state.fenceLen) {
                state.inFence = false;
                state.fenceChar = null;
                state.fenceLen = 0;
            }
        }

        if (line.trim().length) state.lastNonEmptyLine = line;
    }
}

export function snapshotSimpleMarkdown(state: SimpleMdState): string {
    let out = state.buffer;

    const needsTrailingNewline = !out.endsWith("\n");
    if (needsTrailingNewline) out += "\n";

    // Close YAML front matter
    if (state.inYamlFrontmatter) {
        out += "---\n";
    }

    // Close fenced code block
    if (state.inFence && state.fenceChar) {
        out += state.fenceChar.repeat(state.fenceLen || 3) + "\n";
    }

    // Fix dangling links and images
    out = out.replace(/\[([^\]]+)\]\([^)\n]*\n?$/, "[$1](#)\n");
    out = out.replace(/!\[([^\]]*)\]\([^)\n]*\n?$/, "![$1](#)\n");

    // Add table separator if needed (only for incomplete tables)
    if (state.lastNonEmptyLine && /^\s*\|.+\|\s*$/.test(state.lastNonEmptyLine)) {
        const cells = state.lastNonEmptyLine
            .trim()
            .slice(1, -1)
            .split("|")
            .map(s => s.trim());
        // Only add separator if there's no existing separator in the content
        if (!/\n\s*\|?\s*:?-{3,}\s*(\|\s*:?-{3,}\s*)+\|?\s*$/.test(out) && !out.includes("|---------|")) {
            const sep = "|" + cells.map(() => " --- ").join("|") + "|";
            out += sep + "\n";
        }
    }

    return out;
}

// Fixed version of the createMarkdownSplitter function
type MdState = {
  inFence: boolean;
  fenceChar: "`" | "~" | null;
  fenceLen: number;
  inYaml: boolean;
  inlineBacktickOpen: boolean;
  emphStarOpen: boolean;
  emphUnderscoreOpen: boolean;
  htmlStack: string[];
  // For dangling links/images
  openBracketCount: number;   // '[' minus matching ']'
  openParenAfterBracket: boolean; // seen a trailing "[...](" without ')'
  // Table state tracking
  inTable: boolean;
  tableRows: number; // Count of table rows seen
  hasTableSeparator: boolean; // Whether we've seen the separator row
  // List state tracking
  inList: boolean;
  listType: "unordered" | "ordered" | null;
  listItems: number; // Count of list items seen
};

const VOID_HTML = new Set([
  "area","base","br","col","embed","hr","img","input","link","meta",
  "param","source","track","wbr"
]);

function initialState(): MdState {
  return {
    inFence: false,
    fenceChar: null,
    fenceLen: 0,
    inYaml: false,
    inlineBacktickOpen: false,
    emphStarOpen: false,
    emphUnderscoreOpen: false,
    htmlStack: [],
    openBracketCount: 0,
    openParenAfterBracket: false,
    inTable: false,
    tableRows: 0,
    hasTableSeparator: false,
    inList: false,
    listType: null,
    listItems: 0,
  };
}

export function createMarkdownSplitter() {
  function feedAndFindSafeCut(state: any, newChunk: string): number {
    // Normalize newlines and append
    const chunk = newChunk.replace(/\r\n?/g, "\n");
    const buffer = chunk;

    // Scan from the point we left off to the end, updating state
    // Track the last "safe" index (exclusive) where everything is balanced.
    let lastSafeIdx = -1;
    let forcedSafeCut = false; // Flag to prevent overriding explicit safe cuts
    

    // Helper: after finishing a line (or at certain checkpoints), decide if it's safe
    const considerSafe = (idxExclusive: number, lineEnded: boolean) => {
      // Only cut at line boundaries by default (safer for constructs)
      if (!lineEnded) return;
      
      // If we've already set a forced safe cut (e.g., when a list ends), don't override it
      if (forcedSafeCut) return;
      
      // Check if we're in an incomplete table
      // A table is complete if it has a separator and at least one data row after the separator
      // tableRows counts all rows including header, so we need at least 3 total (header + separator + 1 data row)
      const inIncompleteTable = state.inTable && (!state.hasTableSeparator || state.tableRows < 3);
      
      // Check if we're in an incomplete list
      // A list is considered incomplete if we're still in a list (we'll only complete it when we encounter non-list content)
      const inIncompleteList = state.inList;
      
      const balanced =
        !state.inFence &&
        !state.inYaml &&
        !state.inlineBacktickOpen &&
        !state.emphStarOpen &&
        !state.emphUnderscoreOpen &&
        state.htmlStack.length === 0 &&
        state.openBracketCount === 0 &&
        !state.openParenAfterBracket &&
        !inIncompleteTable && // Don't cut in the middle of incomplete tables
        !inIncompleteList; // Don't cut in the middle of incomplete lists
      if (balanced) lastSafeIdx = idxExclusive;
    };

    // We'll parse line by line; this keeps fence/YAML logic simple.
    let i = 0; // Start from the beginning of the chunk
    let lineStart = 0;

    while (i < buffer.length) {
      // Find next newline
      let nl = buffer.indexOf("\n", i);
      if (nl === -1) nl = buffer.length; // last line (no newline yet)
      const line = buffer.slice(lineStart, nl);

      // --- YAML front matter: only if it starts at very top or directly after top ---
      // Open '---' must be the first non-whitespace on the first line of the doc.
      if (lineStart === 0 && /^---\s*$/.test(line) && !state.inYaml) {
        state.inYaml = true;
      } else if (state.inYaml && /^---\s*$/.test(line)) {
        // Closing YAML fence
        state.inYaml = false;
      } else if (!state.inYaml) {
        // --- Fenced code blocks ---
        const fence = line.match(/^\s*([`~]{3,})([\w-+.]*)\s*$/);
        if (fence) {
          const char = fence[1][0] as "`" | "~";
          const len = fence[1].length;
          if (!state.inFence) {
            state.inFence = true;
            state.fenceChar = char;
            state.fenceLen = len;
          } else if (char === state.fenceChar && len >= state.fenceLen) {
            state.inFence = false;
            state.fenceChar = null;
            state.fenceLen = 0;
          }
        }

        // Only do inline & HTML if not in fence
        if (!state.inFence) {
          // Table detection
          const isTableRow = /^\s*\|.*\|.*$/.test(line);
          const isTableSeparator = /^\s*\|?\s*:?-{3,}\s*(\|\s*:?-{3,}\s*)+\|?\s*$/.test(line);
          
          if (isTableRow) {
            if (!state.inTable) {
              // Starting a new table
              state.inTable = true;
              state.tableRows = 1;
              state.hasTableSeparator = false;
            } else {
              // Continuing existing table
              state.tableRows++;
            }
          } else if (isTableSeparator && state.inTable) {
            // This is a table separator row - don't count it as a data row
            state.hasTableSeparator = true;
          } else if (state.inTable && line.trim() === "") {
            // Empty line - could be end of table or just spacing
            // We'll keep the table state for now, let the safe cut logic decide
          } else if (state.inTable && !isTableRow) {
            // Non-table line after table - table has ended
            state.inTable = false;
            state.tableRows = 0;
            state.hasTableSeparator = false;
          }

          // List detection - improved to handle nested lists
          const isUnorderedListItem = /^\s*[-*+]\s+/.test(line);
          const isOrderedListItem = /^\s*\d+\.\s+/.test(line);
          const isListItem = isUnorderedListItem || isOrderedListItem;
          
          // Check for empty list items (e.g., "- " or "1. ") that should end the list
          const isEmptyUnorderedItem = /^\s*[-*+]\s*$/.test(line);
          const isEmptyOrderedItem = /^\s*\d+\.\s*$/.test(line);
          const isEmptyListItem = isEmptyUnorderedItem || isEmptyOrderedItem;
          
          if (isListItem) {
            if (!state.inList) {
              // Starting a new list
              state.inList = true;
              state.listType = isUnorderedListItem ? "unordered" : "ordered";
              state.listItems = 1;
            } else {
              // Continuing existing list (including nested items)
              // Note: We don't distinguish between different list types in nested structures
              // All list items are considered part of the same list until we encounter non-list content
              state.listItems++;
            }
          } else if (state.inList && (line.trim() === "" || isEmptyListItem)) {
            // Empty line or empty list item - end of list
            // Make a safe cut here since we've completed the list
            state.inList = false;
            state.listType = null;
            state.listItems = 0;
            // Make an immediate safe cut at the end of the previous line (end of list)
            // The previous line ended at lineStart, so that's where we should cut
            lastSafeIdx = lineStart;
            forcedSafeCut = true; // Prevent considerSafe from overriding this cut
          } else if (state.inList && !isListItem) {
            // Non-list line after list - list has ended
            // Make a safe cut here since we've completed the list
            state.inList = false;
            state.listType = null;
            state.listItems = 0;
            // Make an immediate safe cut at the end of the previous line (end of list)
            // The previous line ended at lineStart, so that's where we should cut
            lastSafeIdx = lineStart;
            forcedSafeCut = true; // Prevent considerSafe from overriding this cut
          }

          // Inline backticks (single only; fences handled above)
          // Toggle for each single backtick
          let toggler = state.inlineBacktickOpen;
          line.replace(/`+/g, (run) => {
            if (run.length === 1) toggler = !toggler;
            return run;
          });
          state.inlineBacktickOpen = toggler;

          // Emphasis parity (very conservative, good enough for safety)
          const starCount = (line.match(/\*/g) || []).length;
          if (starCount % 2 === 1) state.emphStarOpen = !state.emphStarOpen;
          const underscoreCount = (line.match(/_/g) || []).length;
          if (underscoreCount % 2 === 1) state.emphUnderscoreOpen = !state.emphUnderscoreOpen;

          // HTML tags (super light stack)
          const openTags = line.match(/<([A-Za-z][A-Za-z0-9-]*)(\s[^<>]*)?>/g) || [];
          const closeTags = line.match(/<\/([A-Za-z][A-Za-z0-9-]*)\s*>/g) || [];
          for (const t of openTags) {
            const m = t.match(/^<([A-Za-z][A-Za-z0-9-]*)/);
            const name = m?.[1]?.toLowerCase();
            if (!name) continue;
            if (VOID_HTML.has(name) || /\/>$/.test(t)) continue;
            state.htmlStack.push(name);
          }
          for (const t of closeTags) {
            const m = t.match(/^<\/([A-Za-z][A-Za-z0-9-]*)/);
            const name = m?.[1]?.toLowerCase();
            if (!name) continue;
            const idx = state.htmlStack.lastIndexOf(name);
            if (idx >= 0) state.htmlStack.splice(idx, 1);
          }

          // Dangling link/image like: "[text](" at the line end
          // Track bracket balance naively per line; good enough for splitting.
          // Increase on '[' decrease on ']' but not below 0.
          const opens = (line.match(/\[/g) || []).length;
          const closes = (line.match(/]/g) || []).length;
          let pendingBrackets = Math.max(0, state.openBracketCount + opens - closes);
          state.openBracketCount = pendingBrackets;

          // Detect trailing "[...](" without closing ')'
          if (/\[[^\]]*\]\([^)]*$/.test(line)) {
            state.openParenAfterBracket = true;
          }
          // If we see a ')', we can clear it
          if (/\)/.test(line)) {
            state.openParenAfterBracket = false;
          }
        }
      }

      // After finishing this line, see if it's a safe cut point
      const lineEnded = nl < buffer.length; // true if actual '\n' present
      considerSafe(nl + (lineEnded ? 0 : 0), lineEnded);
      
      // Reset the forced safe cut flag after each line
      forcedSafeCut = false;

      // Advance to next line
      if (nl >= buffer.length) break;
      i = nl + 1;
      lineStart = i;
    }

    // If we never found a safe point in this chunk, keep everything in remainder
    return lastSafeIdx;
  }

  function split(accumulatedBuffer: string): { closed: string; remainder: string } {
    const cut = feedAndFindSafeCut(initialState(), accumulatedBuffer);
    const buffer = accumulatedBuffer.replace(/\r\n?/g, "\n");

    if (cut === -1) {
      // No safe boundary—emit nothing as closed
      return { closed: "", remainder: buffer };
    }

    // Split at the last safe point
    const closed = buffer.slice(0, cut);
    const remainder = buffer.slice(cut);

    return { closed, remainder };
  }

  return { split };
}