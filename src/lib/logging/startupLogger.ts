import { appLogger, type LogMetadata } from "./appLogger";

type RuntimeType = "browser" | "edge" | "node" | "unknown";

const getRuntime = (): RuntimeType => {
  if (typeof process !== "undefined" && process.release?.name === "node") {
    const runtime = process.env.NEXT_RUNTIME;
    if (runtime === "edge") {
      return "edge";
    }

    return "node";
  }

  if (typeof window !== "undefined") {
    return "browser";
  }

  return "unknown";
};

const baseMeta = (): LogMetadata => ({
  runtime: getRuntime(),
  environment: process.env.NODE_ENV ?? "development",
  commitSha: process.env.NEXT_PUBLIC_GIT_SHA,
});

export const logStartupStage = (stage: string, meta?: LogMetadata) => {
  appLogger.info(`Application startup stage: ${stage}`, {
    stage,
    ...baseMeta(),
    ...meta,
  });
};

export const logStartupWarning = (stage: string, meta?: LogMetadata) => {
  appLogger.warn(`Application startup warning: ${stage}`, {
    stage,
    ...baseMeta(),
    ...meta,
  });
};

export const logStartupError = (stage: string, error: unknown, meta?: LogMetadata) => {
  appLogger.error(`Application startup error: ${stage}`, {
    stage,
    error,
    ...baseMeta(),
    ...meta,
  });
};
