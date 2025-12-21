import packageJson from "../package.json";

import { logStartupError, logStartupStage } from "@/lib/logging/startupLogger";

type PackageJson = typeof packageJson;

const getNextVersion = (pkg: PackageJson) => {
  const deps = pkg.dependencies as Record<string, string> | undefined;
  const devDeps = pkg.devDependencies as Record<string, string> | undefined;

  const fromDependencies = deps?.next;
  if (fromDependencies) {
    return fromDependencies;
  }

  return devDeps?.next ?? "unknown";
};

export async function register() {
  try {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      const os = await import("os");
      const memory = process.memoryUsage();
      const cpu = os.cpus()?.[0];

      logStartupStage("server:register", {
        nodeVersion: process.version,
        nextVersion: getNextVersion(packageJson),
        platform: process.platform,
        pid: process.pid,
        uptime: process.uptime(),
        memory: {
          rss: memory.rss,
          heapTotal: memory.heapTotal,
          heapUsed: memory.heapUsed,
          external: memory.external,
        },
        cpuModel: cpu?.model,
        cpuSpeed: cpu?.speed,
        release: packageJson.version,
      });
    }
  } catch (error) {
    logStartupError("server:register", error);
  }
}