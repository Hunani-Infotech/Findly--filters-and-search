import { inspect } from "node:util";
import { Chalk } from "chalk";

/**
 * Shopify CLI and our local prefixer pipe stdout, so TTY detection often
 * disables color. Force 16-color ANSI unless the user opts out.
 */
const chalk = new Chalk({
  level: process.env.FORCE_COLOR === "0" ? 0 : 1,
});

function stringify(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (arg instanceof Error) return arg.stack ?? arg.message;
      return inspect(arg, { colors: false, depth: 4, breakLength: 80 });
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
