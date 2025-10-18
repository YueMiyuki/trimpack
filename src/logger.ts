/**
 * Logger utility for trimpack
 * Provides colored console output and file logging
 */

import { appendFileSync } from "node:fs";
import chalk from "chalk";

export type LogType = "info" | "warn" | "error" | "debug" | "success";

interface LoggerOptions {
  silent?: boolean;
  logFile?: string;
}

class Logger {
  private silent: boolean;
  private logFile: string | null;

  constructor(options: LoggerOptions = {}) {
    this.silent = options.silent ?? false;
    this.logFile = options.logFile ?? null;
  }

  /**
   * Log a message with the specified type
   * @param message The message to log
   * @param type The type of log message
   */
  log(message: string, type: LogType = "info"): void {
    if (this.silent) return;

    const timestamp = this.getTimestamp();
    const formattedMessage = this.formatMessage(message, type);

    // Console output
    console.log(formattedMessage);

    // File output
    if (this.logFile) {
      const fileMessage = `${timestamp} [${type.toUpperCase()}] ${message}\n`;
      try {
        appendFileSync(this.logFile, fileMessage);
      } catch (err) {
        console.error(chalk.red("Failed to write to log file:"), err);
      }
    }
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    this.log(message, "info");
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    this.log(message, "warn");
  }

  /**
   * Log an error message
   */
  error(message: string): void {
    this.log(message, "error");
  }

  /**
   * Log a debug message
   */
  debug(message: string): void {
    this.log(message, "debug");
  }

  /**
   * Log a success message
   */
  success(message: string): void {
    this.log(message, "success");
  }

  /**
   * Format message with color based on type
   */
  private formatMessage(message: string, type: LogType): string {
    const prefix = `[${type.toUpperCase()}]`;

    switch (type) {
      case "info":
        return chalk.blue(`${prefix} ${message}`);
      case "warn":
        return chalk.yellow(`${prefix} ${message}`);
      case "error":
        return chalk.red(`${prefix} ${message}`);
      case "debug":
        return chalk.green(`${prefix} ${message}`);
      case "success":
        return chalk.green(`${prefix} ${message}`);
      default:
        return `${prefix} ${message}`;
    }
  }

  /**
   * Get current timestamp in YYYY/MM/DD HH:MM:SS format
   */
  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const date = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    return `${year}/${month}/${date} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Enable silent mode (no console output)
   */
  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  /**
   * Set log file path
   */
  setLogFile(path: string | null): void {
    this.logFile = path;
  }
}

// Export a default logger instance
export const logger = new Logger();

// Export the Logger class for custom instances
export { Logger };
