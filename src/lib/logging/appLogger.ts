/* eslint-disable no-console */
type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMetadata = Record<string, unknown>;

const consoleMap: Record<LogLevel, (message?: unknown, ...optionalParams: unknown[]) => void> = {
  debug: console.debug ?? console.log,
  info: console.info ?? console.log,
  warn: console.warn ?? console.log,
  error: console.error ?? console.log,
};

const normalizeValue = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
};

const normalizeMeta = (meta?: LogMetadata): LogMetadata | undefined => {
  if (!meta) {
    return undefined;
  }

  return Object.entries(meta).reduce<LogMetadata>((acc, [key, value]) => {
    if (value === undefined) {
      return acc;
    }

    acc[key] = normalizeValue(value);
    return acc;
  }, {});
};

const formatPrefix = (level: LogLevel) =>
  `[Schools-In][${level.toUpperCase()}][${new Date().toISOString()}]`;

const log = (level: LogLevel, message: string, meta?: LogMetadata) => {
  const method = consoleMap[level];
  const payload = normalizeMeta(meta);
  const prefix = `${formatPrefix(level)} ${message}`;

  if (payload && Object.keys(payload).length > 0) {
    method(prefix, payload);
    return;
  }

  method(prefix);
};

export const appLogger = {
  debug(message: string, meta?: LogMetadata) {
    log("debug", message, meta);
  },
  info(message: string, meta?: LogMetadata) {
    log("info", message, meta);
  },
  warn(message: string, meta?: LogMetadata) {
    log("warn", message, meta);
  },
  error(message: string, meta?: LogMetadata) {
    log("error", message, meta);
  },
};

export type { LogLevel };
