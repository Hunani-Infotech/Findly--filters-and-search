import { inspect } from "node:util";
import { Chalk } from "chalk";

/**
 * Shopify CLI and our local prefixer pipe stdout, so TTY detection often
 * disables color. Force 16-color ANSI unless the user opts out.
 */
const chalk = new Chalk({
  level: process.env.FORCE_COLOR === "0" ? 0 : 1,
});

const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|cookie|api[_-]?key|access[_-]?token|private[_-]?key|credential/i;

function redactSecretsInString(value: string): string {
  let out = value;
  if (/postgres(ql)?:\/\//i.test(out) || /rediss?:\/\//i.test(out)) {
    return "[redacted-url]";
  }
  out = out.replace(/\b(shpat|shpss|shpca|shptk)_[A-Za-z0-9]+\b/g, "$1_[redacted]");
  out = out.replace(/\bBearer\s+\S+/gi, "Bearer [redacted]");
  return out;
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSecretsInString(value);
  }
  if (value instanceof Error) {
    const copy = new Error(redactSecretsInString(value.message));
    copy.name = value.name;
    if (value.stack) copy.stack = redactSecretsInString(value.stack);
    return copy;
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redactValue(child);
    }
    return out;
  }
  return value;
}

function stringify(args: unknown[]): string {
  return args
    .map((arg) => {
      const safe = redactValue(arg);
      if (typeof safe === "string") return safe;
      if (safe instanceof Error) return safe.stack ?? safe.message;
      return inspect(safe, { colors: false, depth: 4, breakLength: 80 });
    })
    .join(" ");
}

function paint(
  badge: string,
  color: (text: string) => string,
  args: unknown[],
) {
  return `${badge} ${color(stringify(args))}`;
}

export const log = {
  success: (...args: unknown[]) => {
    console.log(
      paint(chalk.bgGreen.black.bold(" OK "), chalk.green.bold, args),
    );
  },
  error: (...args: unknown[]) => {
    console.error(
      paint(chalk.bgRed.white.bold(" ERR "), chalk.red.bold, args),
    );
  },
  warn: (...args: unknown[]) => {
    console.warn(paint(chalk.bgYellow.black.bold(" WARN "), chalk.yellow, args));
  },
  info: (...args: unknown[]) => {
    console.log(paint(chalk.bgCyan.black.bold(" INFO "), chalk.cyan, args));
  },
  debug: (...args: unknown[]) => {
    console.log(chalk.dim(stringify(args)));
  },
};
