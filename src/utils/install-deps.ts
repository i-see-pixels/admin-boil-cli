import { exec } from "child_process"
import util from "util"
import { spinner } from "@/src/utils/spinner"
import { logger } from "@/src/utils/logger"
import fs from "fs-extra"
import { initOptionsSchema } from "../commands/init"
import { z } from "zod"
import { getInstallCommand, getPackageManager } from "./get-package-manager"

const execPromise = util.promisify(exec)

export async function installDependencies(
  dependencies: string[] = [],
  devDependencies: string[] = [],
  options: z.infer<typeof initOptionsSchema>
) {
  const pkgManager = await getPackageManager(options.cwd)
  const installSpinner = spinner("Installing dependencies...\n").start()

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
