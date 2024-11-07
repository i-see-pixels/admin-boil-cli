import { detect } from "@antfu/ni"

export async function getPackageManager(
  targetDir: string,
  { withFallback }: { withFallback?: boolean } = {
    withFallback: false,
  }
): Promise<"yarn" | "pnpm" | "bun" | "npm"> {
  const packageManager = await detect({ programmatic: true, cwd: targetDir })

  if (packageManager === "yarn@berry") return "yarn"
  if (packageManager === "pnpm@6") return "pnpm"
  if (packageManager === "bun") return "bun"

  if (!withFallback) {
    return packageManager ?? "npm"
  }

  // Fallback to user agent if not detected.
  const userAgent = process.env.npm_config_user_agent || ""

  if (userAgent.startsWith("yarn")) {
    return "yarn"
  }

  if (userAgent.startsWith("pnpm")) {
    return "pnpm"
  }

  if (userAgent.startsWith("bun")) {
    return "bun"
  }

  return "npm"
}

export async function getPackageRunner(cwd: string) {
  const packageManager = await getPackageManager(cwd)

  if (packageManager === "pnpm") return "pnpm dlx"

  if (packageManager === "bun") return "bunx"

  return "npx"
}

/**
 * Constructs the install command based on the package manager.
 * @param pkgManager - The package manager being used.
 * @param packages - Array of packages to install.
 * @param isDev - Whether the packages are dev dependencies.
 */
export function getInstallCommand(
  pkgManager: "npm" | "yarn" | "pnpm" | "bun",
  packages: string[],
  isDev: boolean
): string {
  switch (pkgManager) {
    case "yarn":
      return `yarn add --silent ${isDev ? "-D " : ""}${packages.join(" ")}`
    case "pnpm":
      return `pnpm add --silent ${isDev ? "-D " : ""}${packages.join(" ")}`
    case "bun":
      return `bun add --silent ${isDev ? "--dev " : ""}${packages.join(" ")}`
    default:
      return `npm install --silent ${isDev ? "-D " : ""}${packages.join(" ")}`
  }
}
