import path from "path"
import { initOptionsSchema } from "@/src/commands/init"
import * as ERRORS from "@/src/utils/errors"
import { getProjectInfo } from "@/src/utils/get-project-info"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import fs from "fs-extra"
import { z } from "zod"
import { execSync } from "child_process"

export async function preFlightInit(
  options: z.infer<typeof initOptionsSchema>
) {
  const errors: Record<string, boolean> = {}

  // Check for uncommitted changes
  try {
    const gitStatus = execSync("git status --porcelain", {
      cwd: options.cwd,
    }).toString()

    if (gitStatus.trim()) {
      logger.break()
      logger.warn(
        `There are uncommitted changes in your directory at ${highlighter.info(
          options.cwd
        )}.`
      )
      logger.warn(`Please commit or stash your changes before proceeding.`)
      logger.break()
      process.exit(1)
    }
  } catch (error) {
    logger.break()
    logger.error(
      `Failed to check for uncommitted changes. Ensure Git is installed and initialized in your project directory.`
    )
    logger.break()
    process.exit(1)
  }

  if (
    !fs.existsSync(options.cwd) ||
    !fs.existsSync(path.resolve(options.cwd, "package.json"))
  ) {
    errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT] = true
    return {
      errors,
      projectInfo: null,
    }
  }

  const projectSpinner = spinner(`Preflight checks.`, {
    silent: options.silent,
  }).start()

  if (
    !fs.existsSync(path.resolve(options.cwd, "components.json")) &&
    !options.force
  ) {
    projectSpinner?.fail()
    logger.break()
    logger.error(
      `The ${highlighter.info(
        "components.json"
      )} file does not exit at ${highlighter.info(
        options.cwd
      )}.\nTo start over, properly configure the shadcn project with ${highlighter.info(
        "components.json"
      )} file and run ${highlighter.info("init")} again.`
    )
    logger.break()
    process.exit(1)
  }

  projectSpinner?.succeed()

  const frameworkSpinner = spinner(`Verifying framework.`, {
    silent: options.silent,
  }).start()
  const projectInfo = await getProjectInfo(options.cwd)
  if (!projectInfo || projectInfo?.framework.name != "next-app") {
    errors[ERRORS.UNSUPPORTED_FRAMEWORK] = true
    frameworkSpinner?.fail()
    logger.break()
    if (projectInfo?.framework.links.installation) {
      logger.error(
        `We could not detect a supported framework at ${highlighter.info(
          options.cwd
        )}.\n` +
          `Visit ${highlighter.info(
            projectInfo?.framework.links.installation
          )} to configure your project.\nOnce configured, you can use the cli to add components.`
      )
    }
    logger.break()
    process.exit(1)
  }
  frameworkSpinner?.succeed(
    `Verifying framework. Found ${highlighter.info(
      projectInfo.framework.label
    )}.`
  )

  let tailwindSpinnerMessage = "Validating Tailwind CSS."

  if (projectInfo.tailwindVersion === "v4") {
    tailwindSpinnerMessage = `Validating Tailwind CSS config. Found ${highlighter.info(
      "v4"
    )}.`
  }

  const tailwindSpinner = spinner(tailwindSpinnerMessage, {
    silent: options.silent,
  }).start()
  if (
    projectInfo.tailwindVersion === "v3" &&
    (!projectInfo?.tailwindConfigFile || !projectInfo?.tailwindCssFile)
  ) {
    errors[ERRORS.TAILWIND_NOT_CONFIGURED] = true
    tailwindSpinner?.fail()
  } else if (
    projectInfo.tailwindVersion === "v4" &&
    !projectInfo?.tailwindCssFile
  ) {
    errors[ERRORS.TAILWIND_NOT_CONFIGURED] = true
    tailwindSpinner?.fail()
  } else if (!projectInfo.tailwindVersion) {
    errors[ERRORS.TAILWIND_NOT_CONFIGURED] = true
    tailwindSpinner?.fail()
  } else {
    tailwindSpinner?.succeed()
  }

  const tsConfigSpinner = spinner(`Validating import alias.`, {
    silent: options.silent,
  }).start()
  if (!projectInfo?.aliasPrefix) {
    errors[ERRORS.IMPORT_ALIAS_MISSING] = true
    tsConfigSpinner?.fail()
  } else {
    tsConfigSpinner?.succeed()
  }

  if (Object.keys(errors).length > 0) {
    if (errors[ERRORS.TAILWIND_NOT_CONFIGURED]) {
      logger.break()
      logger.error(
        `No Tailwind CSS configuration found at ${highlighter.info(
          options.cwd
        )}.`
      )
      logger.error(
        `It is likely you do not have Tailwind CSS v4 installed or have an invalid configuration.`
      )
      logger.error(`Install Tailwind CSS then try again.`)
      if (projectInfo?.framework.links.tailwind) {
        logger.error(
          `Visit ${highlighter.info(
            projectInfo?.framework.links.tailwind
          )} to get started.`
        )
      }
    }

    if (errors[ERRORS.IMPORT_ALIAS_MISSING]) {
      logger.break()
      logger.error(`No import alias found in your tsconfig.json file.`)
      if (projectInfo?.framework.links.installation) {
        logger.error(
          `Visit ${highlighter.info(
            projectInfo?.framework.links.installation
          )} to learn how to set an import alias.`
        )
      }
    }

    logger.break()
    process.exit(1)
  }

  return {
    errors,
    projectInfo,
  }
}
