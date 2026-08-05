import type { Tool, ToolResult } from "./types";

/**
 * Phase 7 — Calculator Tool.
 *
 * Supports:
 *   - addition          ("2 + 3", "what is 2 plus 3")
 *   - subtraction       ("10 - 4", "minus")
 *   - multiplication    ("6 * 7", "times", "multiply")
 *   - division          ("20 / 5", "divided by", "over")
 *   - percentages       ("what is 20% of 150", "150 * 20%")
 *   - averages          ("average of 4, 8 and 12", "mean of 1 2 3")
 *   - parentheses       ("(2 + 3) * 4")
 *   - decimal numbers
 *
 * The expression is parsed with a small recursive-descent parser — `eval` is
 * never used — so arbitrary code execution is impossible.
 */

const AVERAGE_RE =
  /\b(?:average|mean|avg)\s+of\s+(.+)$/i;

const PERCENTAGE_OF_RE =
  /\bwhat\s+is\s+([0-9]+(?:\.[0-9]+)?)\s*(?:%|percent)\s+of\s+([0-9]+(?:\.[0-9]+)?)\b/i;

const MATH_KEYWORDS = [
  /[0-9]\s*[+\-*\/^x×]\s*[0-9]/i,   // "2+3", "10 / 5"
  /\b(?:plus|minus|times|multiplied\s+by|divided\s+by|over|percent|percentage)\b/i,
  /\b(?:average|mean|avg)\s+of\b/i,
];

/** Token kind produced by the lexer. */
type TokenKind = "number" | "operator" | "lparen" | "rparen" | "eof";

interface Token {
  kind: TokenKind;
  value: string;
  number?: number;
}

/** Converts a math keyword to its symbolic operator. */
function normalizeOperator(word: string): string | null {
  switch (word.toLowerCase()) {
    case "plus":
    case "add":
      return "+";
    case "minus":
    case "subtract":
      return "-";
    case "times":
    case "multiply":
    case "multiplied":
    case "multiplied by":
      return "*";
    case "divide":
    case "divided":
    case "divided by":
    case "over":
      return "/";
    case "x":
    case "×":
      return "*";
    default:
      return null;
  }
}

/** Extracts the raw expression from a natural-language sentence. */
function extractExpression(input: string): string | null {
  const trimmed = input.trim();

  // "what is 20% of 150"
  const percentageOf = PERCENTAGE_OF_RE.exec(trimmed);
  if (percentageOf) {
    const amount = Number(percentageOf[1]);
    const base = Number(percentageOf[2]);
    return `(${amount} / 100) * ${base}`;
  }

  // "average of 4, 8 and 12" / "mean of 4 8 12"
  const average = AVERAGE_RE.exec(trimmed);
  if (average) {
    const numbers = extractNumbers(average[1]);
    if (numbers.length >= 2) {
      return `(${numbers.join(" + ")}) / ${numbers.length}`;
    }
    return null;
  }

  // Strip common question prefixes so the parser sees only math.
  let expression = trimmed
    .replace(/^(?:what|whats|what is|calculate|compute|solve|evaluate|find)\s+/i, "")
    .replace(/[?.,!]+$/, "")
    .trim();

  // Replace natural-language operators.
  expression = expression
    .replace(/\b(?:multiplied\s+by|multiply\s+by|divided\s+by|multiplied|divided|plus|minus|times|multiply|divide|over)\b/gi, (match) => {
      return normalizeOperator(match) ?? match;
    })
    .replace(/\bpercent\b/gi, "%")
    .replace(/\bx\b/gi, "*")
    .replace(/[×]/g, "*")
    .replace(/\s+/g, " ")
    .trim();

  // Normalize "5%" at the end of an expression to "(5/100)".
  expression = expression.replace(/([0-9]+(?:\.[0-9]+)?)\s*%/g, (_, num) => {
    return `(${num} / 100)`;
  });

  return expression;
}

/** Extracts all decimal numbers from a string (used for averages). */
function extractNumbers(text: string): number[] {
  const matches = text.match(/[0-9]+(?:\.[0-9]+)?/g);
  return (matches ?? []).map((value) => Number(value)).filter((n) => Number.isFinite(n));
}

/**
 * Safe expression evaluator (recursive descent).
 *
 * Grammar:
 *   expr    := term (('+' | '-') term)*
 *   term    := factor (('*' | '/') factor)*
 *   factor  := number | '(' expr ')'
 */
class ExpressionEvaluator {
  private tokens: Token[];
  private position = 0;

  constructor(expression: string) {
    this.tokens = tokenize(expression);
  }

  evaluate(): number {
    const value = this.parseExpression();
    const current = this.tokens[this.position];
    if (current.kind !== "eof") {
      throw new Error(`Unexpected token: ${current.value}`);
    }
    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (true) {
      const token = this.tokens[this.position];
      if (token.kind === "operator" && (token.value === "+" || token.value === "-")) {
        this.position++;
        const right = this.parseTerm();
        value = token.value === "+" ? value + right : value - right;
      } else {
        return value;
      }
    }
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    while (true) {
      const token = this.tokens[this.position];
      if (token.kind === "operator" && (token.value === "*" || token.value === "/")) {
        this.position++;
        const right = this.parseFactor();
        if (token.value === "/" && right === 0) {
          throw new Error("Division by zero");
        }
        value = token.value === "*" ? value * right : value / right;
      } else {
        return value;
      }
    }
  }

  private parseFactor(): number {
    const token = this.tokens[this.position];
    if (token.kind === "number") {
      this.position++;
      return token.number ?? 0;
    }
    if (token.kind === "lparen") {
      this.position++;
      const value = this.parseExpression();
      const closing = this.tokens[this.position];
      if (closing.kind !== "rparen") {
        throw new Error("Missing closing parenthesis");
      }
      this.position++;
      return value;
    }
    throw new Error(`Unexpected token: ${token.value || token.kind}`);
  }
}

/** Splits an expression string into tokens. */
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (/\s/.test(char)) {
      index++;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      const match = /^[0-9]+(?:\.[0-9]+)?/.exec(source.slice(index));
      if (!match) throw new Error(`Invalid number near: ${source.slice(index, index + 10)}`);
      tokens.push({ kind: "number", value: match[0], number: Number(match[0]) });
      index += match[0].length;
      continue;
    }

    if ("+-*/".includes(char)) {
      tokens.push({ kind: "operator", value: char });
      index++;
      continue;
    }

    if (char === "(") {
      tokens.push({ kind: "lparen", value: char });
      index++;
      continue;
    }

    if (char === ")") {
      tokens.push({ kind: "rparen", value: char });
      index++;
      continue;
    }

    throw new Error(`Unexpected character: ${char}`);
  }

  tokens.push({ kind: "eof", value: "" });
  return tokens;
}

/** Formats a numeric result (strips trailing zeros, handles integers). */
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("Result is not a finite number");
  }
  const rounded = Math.round(value * 1e10) / 1e10;
  return String(rounded);
}

/** Detects whether a message might be a math request. */
function canHandle(input: string): boolean {
  const text = input.toLowerCase();
  return (
    AVERAGE_RE.test(text) ||
    PERCENTAGE_OF_RE.test(text) ||
    MATH_KEYWORDS.some((pattern) => pattern.test(text))
  );
}

/** Executes the calculator tool. */
async function execute(input: string): Promise<ToolResult> {
  const started = performance.now();

  const extracted = extractExpression(input);
  if (!extracted) {
    return {
      success: false,
      toolId: "calculator",
      output: "",
      executionTime: performance.now() - started,
    };
  }

  try {
    const evaluator = new ExpressionEvaluator(extracted);
    const value = evaluator.evaluate();
    const output = formatNumber(value);

    return {
      success: true,
      toolId: "calculator",
      output: `Calculation result: ${output}`,
      metadata: {
        label: "🧮 Calculator",
        summary: `Computed: ${extracted} = ${output}`,
        data: { expression: extracted, result: output },
      },
      executionTime: performance.now() - started,
    };
  } catch (error) {
    return {
      success: false,
      toolId: "calculator",
      output: "",
      metadata: {
        label: "🧮 Calculator",
        summary: "Unable to parse the math expression.",
      },
      executionTime: performance.now() - started,
    };
  }
}

/** The Calculator tool instance. */
export const calculatorTool: Tool = {
  id: "calculator",
  name: "Calculator",
  description:
    "Performs arithmetic: addition, subtraction, multiplication, division, percentages, and averages.",
  // Empty = available to all agents.
  enabledAgents: [],
  inputSchema: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "The math expression or natural-language math question.",
      },
    },
    required: ["expression"],
  },
  canHandle,
  execute,
};