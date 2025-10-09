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
