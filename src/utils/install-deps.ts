import { exec } from "child_process"
import util from "util"
import { spinner } from "@/src/utils/spinner"
import { logger } from "@/src/utils/logger"
import fs from "fs-extra"
import { initOptionsSchema } from "../commands/init"
import { z } from "zod"
import { getInstallCommand, getPackageManager } from "./get-package-manager"
import GithubRegistry from "./registry"

const execPromise = util.promisify(exec)

export async function installDependencies(
  options: z.infer<typeof initOptionsSchema>,
  githubRepo: GithubRegistry
) {
  const pkgManager = await getPackageManager(options.cwd)
  const installSpinner = spinner("Installing dependencies...\n").start()

  let dependencies: string[] = []
  let devDependencies: string[] = []
  try {
    const packageJsonBuffer = await githubRepo.fetchFileContent("package.json")
    const packageJsonPath = `${options.cwd}/package.json`
    const { missingDependencies, missingDevDependencies } =
      await comparePackageJsonDependencies(packageJsonBuffer, packageJsonPath)
    dependencies = missingDependencies
    devDependencies = missingDevDependencies
  } catch (error) {
    installSpinner?.fail("Failed to fetch package.json.")
    logger.error((error as Error).message)
    process.exit(1)
  }

  try {
    if (dependencies.length > 0) {
      const depCmd = getInstallCommand(pkgManager, dependencies, false)
      const { stdout, stderr } = await execPromise(depCmd)
      if (!options.silent) logger.info(stdout)
      if (stderr) logger.warn(stderr)
    }

    if (devDependencies.length > 0) {
      const devDepCmd = getInstallCommand(pkgManager, devDependencies, true)
      const { stdout, stderr } = await execPromise(devDepCmd)
      if (!options.silent) logger.info(stdout)
      if (stderr) logger.warn(stderr)
    }

    installSpinner?.succeed("Dependencies installed successfully!")
  } catch (error) {
    installSpinner?.fail("Failed to install dependencies.")
    logger.error((error as Error).message)
    process.exit(1)
  }
}

interface DependencyComparisonResult {
  missingDependencies: string[]
  missingDevDependencies: string[]
}

async function comparePackageJsonDependencies(
  base64PackageJson: string,
  packageJsonPath: string
): Promise<DependencyComparisonResult> {
  // Decode the base64 string into a JSON object
  const decodedPackageJson = JSON.parse(
    Buffer.from(base64PackageJson, "base64").toString("utf-8")
  )

  // Read the second package.json file
  const packageJson2 = await fs.readJSON(packageJsonPath)

  const dependencies1 = decodedPackageJson.dependencies || {}
  const devDependencies1 = decodedPackageJson.devDependencies || {}

  const dependencies2 = packageJson2.dependencies || {}
  const devDependencies2 = packageJson2.devDependencies || {}

  const missingDependencies = Object.keys(dependencies1).filter(
    (dep) => !dependencies2[dep]
  )

  const missingDevDependencies = Object.keys(devDependencies1).filter(
    (devDep) => !devDependencies2[devDep]
  )

  return {
    missingDependencies,
    missingDevDependencies,
  }
}
