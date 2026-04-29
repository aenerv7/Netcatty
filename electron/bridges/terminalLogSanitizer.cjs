/**
 * Terminal log sanitizer.
 *
 * This is intentionally stateful: terminal output is a stream of cursor and
 * erase operations, not plain text with decoration. The renderer below keeps a
 * small virtual text buffer so plain-text and HTML logs reflect what common
 * line-editing output actually leaves on screen.
 */

const CSI_FINAL_RE = /[@-~]/;
const DEFAULT_FOREGROUND = "#d4d4d4";
const DEFAULT_BACKGROUND = "#1e1e1e";
const BASIC_COLORS = [
  "#000000",
  "#cd3131",
  "#0dbc79",
  "#e5e510",
  "#2472c8",
  "#bc3fbc",
  "#11a8cd",
  "#e5e5e5",
];
const BRIGHT_COLORS = [
  "#666666",
  "#f14c4c",
  "#23d18b",
  "#f5f543",
  "#3b8eea",
  "#d670d6",
  "#29b8db",
  "#ffffff",
];

class TerminalTextRenderer {
  constructor() {
    this.lines = [[]];
    this.row = 0;
    this.col = 0;
    this.state = "normal";
    this.escapeBuffer = "";
    this.style = createDefaultStyle();
  }

  feed(input) {
    if (!input) return;

    for (const ch of input) {
      this.#consume(ch);
    }
  }

  finish() {
    this.state = "normal";
    this.escapeBuffer = "";
    return this.toString();
  }

  toString() {
    return this.lines
      .map((line) => line.map((cell) => cell?.ch || " ").join("").replace(/[ \t]+$/g, ""))
      .join("\n")
      .replace(/\n+$/g, "");
  }

  toHtmlContent() {
    return this.lines
      .map((line) => renderLineHtml(line))
      .join("\n")
      .replace(/\n+$/g, "");
  }

  #consume(ch) {
    if (this.state === "esc") {
      this.#consumeEsc(ch);
      return;
    }
    if (this.state === "csi") {
      this.escapeBuffer += ch;
      if (CSI_FINAL_RE.test(ch)) {
        this.#applyCsi(this.escapeBuffer);
        this.state = "normal";
        this.escapeBuffer = "";
      }
      return;
    }
    if (this.state === "osc") {
      if (ch === "\x07") {
        this.state = "normal";
        this.escapeBuffer = "";
        return;
      }
      if (ch === "\x1b") {
        this.state = "oscEsc";
      }
      return;
    }
    if (this.state === "oscEsc") {
      this.state = ch === "\\" ? "normal" : "osc";
      return;
    }

    switch (ch) {
      case "\x1b":
        this.state = "esc";
        this.escapeBuffer = "";
        break;
      case "\b":
        this.col = Math.max(0, this.col - 1);
        break;
      case "\r":
        this.col = 0;
        break;
      case "\n":
        this.row += 1;
        this.col = 0;
        this.#ensureLine();
        break;
      case "\t":
        this.#writeText(" ".repeat(8 - (this.col % 8)));
        break;
      default:
        if (this.#isPrintable(ch)) this.#writeText(ch);
        break;
    }
  }

  #consumeEsc(ch) {
    if (ch === "[") {
      this.state = "csi";
      this.escapeBuffer = "";
      return;
    }
    if (ch === "]") {
      this.state = "osc";
      this.escapeBuffer = "";
      return;
    }
    // Single-character ESC sequences are terminal controls. Ignore them for
    // logs, but consume them so they never leak into txt/html output.
    this.state = "normal";
    this.escapeBuffer = "";
  }

  #applyCsi(sequence) {
    const final = sequence.at(-1);
    const params = sequence.slice(0, -1);
    const values = params
      .replace(/[?><=]/g, "")
      .split(";")
      .map((part) => {
        if (part === "") return undefined;
        const n = Number.parseInt(part, 10);
        return Number.isFinite(n) ? n : undefined;
      });
    const n = values[0] || 1;

    switch (final) {
      case "A":
        this.row = Math.max(0, this.row - n);
        this.#ensureLine();
        break;
      case "B":
      case "E":
        this.row += n;
        if (final === "E") this.col = 0;
        this.#ensureLine();
        break;
      case "C":
        this.col += n;
        break;
      case "D":
        this.col = Math.max(0, this.col - n);
        break;
      case "F":
        this.row = Math.max(0, this.row - n);
        this.col = 0;
        this.#ensureLine();
        break;
      case "G":
        this.col = Math.max(0, n - 1);
        break;
      case "H":
      case "f":
        this.row = Math.max(0, (values[0] || 1) - 1);
        this.col = Math.max(0, (values[1] || 1) - 1);
        this.#ensureLine();
        break;
      case "J":
        this.#eraseDisplay(values[0] || 0);
        break;
      case "K":
        this.#eraseLine(values[0] || 0);
        break;
      case "m":
        this.#applySgr(values);
        break;
      default:
        // Unsupported CSI controls are intentionally ignored.
        break;
    }
  }

  #applySgr(values) {
    const codes = values.length > 0 ? values : [0];

    for (let i = 0; i < codes.length; i += 1) {
      const code = codes[i] ?? 0;

      if (code === 0) {
        this.style = createDefaultStyle();
      } else if (code === 1) {
        this.style.bold = true;
      } else if (code === 3) {
        this.style.italic = true;
      } else if (code === 4) {
        this.style.underline = true;
      } else if (code === 7) {
        this.style.inverse = true;
      } else if (code === 22) {
        this.style.bold = false;
      } else if (code === 23) {
        this.style.italic = false;
      } else if (code === 24) {
        this.style.underline = false;
      } else if (code === 27) {
        this.style.inverse = false;
      } else if (code >= 30 && code <= 37) {
        this.style.fg = BASIC_COLORS[code - 30];
      } else if (code === 39) {
        this.style.fg = null;
      } else if (code >= 40 && code <= 47) {
        this.style.bg = BASIC_COLORS[code - 40];
      } else if (code === 49) {
        this.style.bg = null;
      } else if (code >= 90 && code <= 97) {
        this.style.fg = BRIGHT_COLORS[code - 90];
      } else if (code >= 100 && code <= 107) {
        this.style.bg = BRIGHT_COLORS[code - 100];
      } else if ((code === 38 || code === 48) && codes[i + 1] === 5) {
        const color = colorFromAnsi256(codes[i + 2]);
        if (color) {
          if (code === 38) this.style.fg = color;
          else this.style.bg = color;
        }
        i += 2;
      } else if ((code === 38 || code === 48) && codes[i + 1] === 2) {
        const color = colorFromRgb(codes[i + 2], codes[i + 3], codes[i + 4]);
        if (color) {
          if (code === 38) this.style.fg = color;
          else this.style.bg = color;
        }
        i += 4;
      }
    }
  }

  #writeText(text) {
    this.#ensureLine();
    const line = this.lines[this.row];
    while (line.length < this.col) line.push(createCell(" ", createDefaultStyle()));
    for (const ch of text) {
      line[this.col] = createCell(ch, this.style);
      this.col += 1;
    }
  }

  #eraseLine(mode) {
    this.#ensureLine();
    const line = this.lines[this.row];
    if (mode === 1) {
      for (let i = 0; i <= this.col && i < line.length; i += 1) {
        line[i] = createCell(" ", createDefaultStyle());
      }
      return;
    }
    if (mode === 2) {
      this.lines[this.row] = [];
      return;
    }
    line.length = Math.min(line.length, this.col);
  }

  #eraseDisplay(mode) {
    this.#ensureLine();
    if (mode === 2 || mode === 3) {
      this.lines = [[]];
      this.row = 0;
      this.col = 0;
      return;
    }
    if (mode === 1) {
      this.lines = this.lines.slice(this.row);
      this.row = 0;
      this.#eraseLine(1);
      return;
    }
    this.#eraseLine(0);
    this.lines.length = this.row + 1;
  }

  #ensureLine() {
    while (this.lines.length <= this.row) this.lines.push([]);
  }

  #isPrintable(ch) {
    const code = ch.codePointAt(0);
    if (code === undefined) return false;
    return code >= 0x20 && code !== 0x7f;
  }
}

function terminalDataToPlainText(terminalData) {
  const renderer = new TerminalTextRenderer();
  renderer.feed(terminalData || "");
  return renderer.finish();
}

function terminalDataToHtmlContent(terminalData) {
  const renderer = new TerminalTextRenderer();
  renderer.feed(terminalData || "");
  renderer.finish();
  return renderer.toHtmlContent();
}

function createTerminalTextRenderer() {
  return new TerminalTextRenderer();
}

module.exports = {
  TerminalTextRenderer,
  createTerminalTextRenderer,
  terminalDataToHtmlContent,
  terminalDataToPlainText,
};

function createDefaultStyle() {
  return {
    fg: null,
    bg: null,
    bold: false,
    italic: false,
    underline: false,
    inverse: false,
  };
}

function createCell(ch, style) {
  return {
    ch,
    style: { ...style },
  };
}

function renderLineHtml(line) {
  let html = "";
  let runText = "";
  let runStyle = null;

  const flush = () => {
    if (!runText) return;
    const escaped = escapeHtml(runText);
    const style = styleToCss(runStyle);
    html += style ? `<span style="${style}">${escaped}</span>` : escaped;
    runText = "";
  };

  const trimmedLength = getTrimmedLineLength(line);
  for (let i = 0; i < trimmedLength; i += 1) {
    const cell = line[i] || createCell(" ", createDefaultStyle());
    if (!runStyle || !stylesEqual(runStyle, cell.style)) {
      flush();
      runStyle = cell.style;
    }
    runText += cell.ch;
  }
  flush();
  return html;
}

function getTrimmedLineLength(line) {
  let length = line.length;
  while (length > 0) {
    const cell = line[length - 1];
    const ch = cell?.ch || " ";
    if (ch !== " " && ch !== "\t") break;
    if (styleToCss(cell?.style)) break;
    length -= 1;
  }
  return length;
}

function styleToCss(style) {
  if (!style) return "";
  const declarations = [];
  const fg = style.inverse ? (style.bg || DEFAULT_BACKGROUND) : style.fg;
  const bg = style.inverse ? (style.fg || DEFAULT_FOREGROUND) : style.bg;
  if (fg) declarations.push(`color: ${fg}`);
  if (bg) declarations.push(`background-color: ${bg}`);
  if (style.bold) declarations.push("font-weight: 700");
  if (style.italic) declarations.push("font-style: italic");
  if (style.underline) declarations.push("text-decoration: underline");
  return declarations.join("; ");
}

function stylesEqual(a, b) {
  return (
    a.fg === b.fg &&
    a.bg === b.bg &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.inverse === b.inverse
  );
}

function colorFromAnsi256(value) {
  if (!Number.isInteger(value) || value < 0 || value > 255) return null;
  if (value < 8) return BASIC_COLORS[value];
  if (value < 16) return BRIGHT_COLORS[value - 8];
  if (value < 232) {
    const n = value - 16;
    const r = Math.floor(n / 36);
    const g = Math.floor((n % 36) / 6);
    const b = n % 6;
    return colorFromRgb(colorCubeValue(r), colorCubeValue(g), colorCubeValue(b));
  }
  const level = 8 + (value - 232) * 10;
  return colorFromRgb(level, level, level);
}

function colorCubeValue(n) {
  return n === 0 ? 0 : 55 + n * 40;
}

function colorFromRgb(r, g, b) {
  if (![r, g, b].every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    return null;
  }
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

function hex2(value) {
  return value.toString(16).padStart(2, "0");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
