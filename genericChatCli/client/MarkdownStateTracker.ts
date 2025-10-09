// Enhanced markdown state tracker for streaming content
// Based on the external source code with comprehensive state management

export type MdStreamState = {
    inFence: boolean;
    fenceChar: "`" | "~" | null;
    fenceLen: number;
    inlineBacktickOpen: boolean;
    emphStarOpen: boolean;
    emphUnderscoreOpen: boolean;
    htmlTagStack: string[];
    inYamlFrontmatter: boolean;      // after starting '---' at top
    lastNonEmptyLine: string | null; // for table heuristics
    buffer: string;                  // full accumulated md
};

const VOID_HTML = new Set([
    "area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"
]);

export function createMdState(): MdStreamState {
    return {
        inFence: false,
        fenceChar: null,
        fenceLen: 0,
        inlineBacktickOpen: false,
        emphStarOpen: false,
        emphUnderscoreOpen: false,
        htmlTagStack: [],
        inYamlFrontmatter: false,
        lastNonEmptyLine: null,
        buffer: "",
    };
}

export function feedChunk(state: MdStreamState, chunk: string): void {
    // normalize newlines to \n
    const text = chunk.replace(/\r\n?/g, "\n");
    state.buffer += text;

    // fast scans line-by-line to update state
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // YAML front matter detection only at very top or right after start
        if (!state.buffer.trimStart().slice(0, 3).localeCompare("---", undefined, { sensitivity: "base" })) {
            // if buffer starts with '---', mark open
            if (!state.inYamlFrontmatter) state.inYamlFrontmatter = true;
        }
        if (state.inYamlFrontmatter && /^---\s*$/.test(line) && state.buffer.indexOf("---") !== 0) {
            // closing '---' later in doc closes it as well
            state.inYamlFrontmatter = false;
        }

        // Fenced code block start/close
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
        } else if (!state.inFence) {
            // Update inline toggles only outside fences
            // Backticks (single only)
            let open = state.inlineBacktickOpen;
            line.replace(/`+/g, (run) => {
                if (run.length === 1) open = !open;
                return run;
            });
            state.inlineBacktickOpen = open;

            // Emphasis (very conservative)
            // Count standalone markers; flip parity if odd
            const starCount = (line.match(/\*/g) || []).length;
            if (starCount % 2 === 1) state.emphStarOpen = !state.emphStarOpen;
            const underscoreCount = (line.match(/_/g) || []).length;
            if (underscoreCount % 2 === 1) state.emphUnderscoreOpen = !state.emphUnderscoreOpen;

            // HTML tags (simple)
            const opens = line.match(/<([A-Za-z][A-Za-z0-9-]*)(\s[^<>]*)?>/g) || [];
            const closes = line.match(/<\/([A-Za-z][A-Za-z0-9-]*)\s*>/g) || [];
            for (const t of opens) {
                const m = t.match(/^<([A-Za-z][A-Za-z0-9-]*)/);
                const name = m?.[1]?.toLowerCase();
                if (!name) continue;
                if (VOID_HTML.has(name) || /\/>$/.test(t)) continue;
                state.htmlTagStack.push(name);
            }
            for (const t of closes) {
                const m = t.match(/^<\/([A-Za-z][A-Za-z0-9-]*)/);
                const name = m?.[1]?.toLowerCase();
                if (!name) continue;
                const idx = state.htmlTagStack.lastIndexOf(name);
                if (idx >= 0) state.htmlTagStack.splice(idx, 1);
            }
        }

        if (line.trim().length) state.lastNonEmptyLine = line;
    }
}

/**
 * Produce a syntactically closed Markdown snapshot WITHOUT mutating the existing buffer.
 * This is what you pass to downstream tools (remark, pandoc, md-to-pdf, mdast, etc.).
 */
export function snapshotMarkdown(state: MdStreamState): string {
    let out = state.buffer;

    const needsTrailingNewline = !out.endsWith("\n");
    if (needsTrailingNewline) out += "\n";

    // Close YAML front matter if it's open at the snapshot point
    if (state.inYamlFrontmatter) {
        out += "---\n";
    }

    // Close a dangling fenced code block
    if (state.inFence && state.fenceChar) {
        out += state.fenceChar.repeat(state.fenceLen || 3) + "\n";
    }

    // Close inline code/emphasis conservatively (outside fences)
    if (state.inlineBacktickOpen) out += "`";
    if (state.emphStarOpen) out += "*";
    if (state.emphUnderscoreOpen) out += "_";

    // Close the most recent unclosed HTML tag (don't try to close the whole stack at once)
    if (state.htmlTagStack.length) {
        out += `</${state.htmlTagStack[state.htmlTagStack.length - 1]}>`;
    }

    // Fix a dangling markdown link or image at EOF: "[text](" or "![alt]("
    out = out.replace(/\[([^\]]+)\]\((?![^)]+)\s*$/m, "[$1](#)");
    out = out.replace(/!\[([^\]]*)\]\((?![^)]+)\s*$/m, "![$1](#)");

    // Table header helper: if the last non-empty line looks like a header row without a separator, add one.
    if (state.lastNonEmptyLine && /^\s*\|.+\|\s*$/.test(state.lastNonEmptyLine)) {
        const cells = state.lastNonEmptyLine
            .trim()
            .slice(1, -1)
            .split("|")
            .map(s => s.trim());
        if (!/\n\s*\|?\s*:?-{3,}\s*(\|\s*:?-{3,}\s*)+\|?\s*$/.test(out)) {
            const sep = "|" + cells.map(() => " --- ").join("|") + "|";
            out += sep + "\n";
        }
    }

    return out;
}
