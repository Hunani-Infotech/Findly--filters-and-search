/**
 * Colored terminal output for Node scripts (verify, seed, predev).
 * Shopify CLI / pipes often hide TTY, so 16-color ANSI is forced.
 */
import { Chalk } from "chalk";

export const chalk = new Chalk({
  level: process.env.FORCE_COLOR === "0" ? 0 : 1,
});

function paint(badge, color, message) {
  return `${badge} ${color(message)}`;
}

export const log = {
  success: (message) => {
    console.log(
      paint(chalk.bgGreen.black.bold(" OK "), chalk.green.bold, message),
    );
  },
  error: (message) => {
    console.error(
      paint(chalk.bgRed.white.bold(" ERR "), chalk.red.bold, message),
    );
  },
  warn: (message) => {
    console.warn(
      paint(chalk.bgYellow.black.bold(" WARN "), chalk.yellow, message),
    );
  },
  info: (message) => {
    console.log(paint(chalk.bgCyan.black.bold(" INFO "), chalk.cyan, message));
  },
};
