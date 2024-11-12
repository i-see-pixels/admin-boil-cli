import { Command } from "commander"
import prompts from "prompts"
import { z } from "zod"
import path from "path"
import { logger } from "@/src/utils/logger"
import { highlighter } from "@/src/utils/highlighter"
import { handleError } from "@/src/utils/handle-error"
import { preFlightInit } from "@/src/preflights/preflight-init"
import * as ERRORS from "@/src/utils/errors"
import { createProject } from "@/src/utils/create-project"
import { getProjectConfig, getProjectInfo } from "@/src/utils/get-project-info"
import {
  DEFAULT_COMPONENTS,
  DEFAULT_TAILWIND_CONFIG,
  DEFAULT_TAILWIND_CSS,
  DEFAULT_UTILS,
  getConfig,
  rawConfigSchema,
  resolveConfigPaths,
  type Config,
} from "@/src/utils/get-config"
import { spinner } from "../utils/spinner"
import GithubRegistry from "../utils/registry"
import { installDependencies } from "../utils/install-deps"
import { installShadcnComps } from "../utils/install-shadcn-comps"
import { admin_boilInstance } from "../utils/axiosinstance"
import axios from "axios"

export const initOptionsSchema = z.object({
  cwd: z.string(),
  yes: z.boolean(),
  defaults: z.boolean(),
  force: z.boolean(),
  silent: z.boolean(),
  isNewProject: z.boolean(),
  srcDir: z.boolean().optional(),
})

const deps = {
  default: [
    "@neondatabase/serverless",
    "@tanstack/react-table",
    "@upstash/redis",
    "drizzle-orm",
    "jotai",
    "next-themes",
    "recharts",
  ],
  dev: ["drizzle-kit", "tsx"],
}

export const init = new Command()
  .name("init")
  .description("initialize your project and install dependencies")
  .option("-y, --yes", "skip confirmation prompt.", true)
  .option("-d, --defaults,", "use default configuration.", false)
  .option("-f, --force", "force overwrite of existing configuration.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .option("-s, --silent", "mute output.", false)
  .option(
    "--src-dir",
    "use the src directory when creating a new project.",
    false
  )
  .action(async (opts) => {
    try {
      const options = initOptionsSchema.parse({
        cwd: path.resolve(opts.cwd),
        isNewProject: false,
        ...opts,
      })

      await runInit(options)

      logger.log(
        `${highlighter.success(
          "Success!"
        )} Project initialization completed.\nYou may now add components.`
      )
      logger.break()
    } catch (error) {
      logger.break()
      handleError(error)
    }
  })

export async function runInit(
  options: z.infer<typeof initOptionsSchema> & {
    skipPreflight?: boolean
  }
) {
  let projectInfo
  if (!options.skipPreflight) {
    const preflight = await preFlightInit(options)
    if (preflight.errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT]) {
      const { projectPath } = await createProject(options)
      if (!projectPath) {
        process.exit(1)
      }
      options.cwd = projectPath
      options.isNewProject = true
    }
    projectInfo = preflight.projectInfo
  } else {
    projectInfo = await getProjectInfo(options.cwd)
  }

  const projectConfig = await getProjectConfig(options.cwd, projectInfo)
  const config = projectConfig ? projectConfig : await promptForConfig()

  if (!options.yes) {
    const { proceed } = await prompts({
      type: "confirm",
      name: "proceed",
      message: `Write configuration to ${highlighter.info(
        "components.json"
      )}. Proceed?`,
      initial: true,
    })

    if (!proceed) {
      process.exit(0)
    }
  }

  // for (let option in options) {
  //   logger.info(option + ": " + options[option as keyof typeof options])
  // }

  // const optionConfig = await getPromptConfig(options)

  const verification = await apiVerification()

  if (verification.ok) {
    //Copy files
    await copyFiles(options)

    //Install dependencies
    await installDependencies(deps.default, deps.dev, options)

    //Install shadcn components
    await installShadcnComps(options, projectInfo)

    const fullConfig = await resolveConfigPaths(options.cwd, config)

    return fullConfig
  } else {
    process.exit(1)
  }
}

async function promptForConfig(defaultConfig: Config | null = null) {
  logger.info("")
  const options = await prompts([
    {
      type: "toggle",
      name: "typescript",
      message: `Would you like to use ${highlighter.info(
        "TypeScript"
      )} (recommended)?`,
      initial: defaultConfig?.tsx ?? true,
      active: "yes",
      inactive: "no",
    },
    {
      type: "text",
      name: "tailwindPrefix",
      message: `Are you using a custom ${highlighter.info(
        "tailwind prefix eg. tw-"
      )}? (Leave blank if not)`,
      initial: "",
    },
    {
      type: "text",
      name: "components",
      message: `Configure the import alias for ${highlighter.info(
        "components"
      )}:`,
      initial: defaultConfig?.aliases["components"] ?? DEFAULT_COMPONENTS,
    },
    {
      type: "text",
      name: "utils",
      message: `Configure the import alias for ${highlighter.info("utils")}:`,
      initial: defaultConfig?.aliases["utils"] ?? DEFAULT_UTILS,
    },
    {
      type: "toggle",
      name: "rsc",
      message: `Are you using ${highlighter.info("React Server Components")}?`,
      initial: defaultConfig?.rsc ?? true,
      active: "yes",
      inactive: "no",
    },
  ])

  return rawConfigSchema.parse({
    $schema: "https://ui.shadcn.com/schema.json",
    rsc: options.rsc,
    tsx: options.typescript,
    aliases: {
      utils: options.utils,
      components: options.components,
      // TODO: fix this.
      lib: options.components.replace(/\/components$/, "lib"),
      hooks: options.components.replace(/\/components$/, "hooks"),
      iconLibrary: defaultConfig?.iconLibrary,
    },
  })
}

async function getPromptConfig(
  inlineOptions: z.infer<typeof initOptionsSchema>
) {
  const options = await prompts([
    {
      type: "toggle",
      name: "database",
      message: `Would you like to setup a ${highlighter.info(
        "PostgreSQL with Drizzle"
      )} (recommended)?`,
      initial: true,
      active: "yes",
      inactive: "no",
    },
  ])

  return {
    database: options.database,
  }
}

async function copyFiles(
  options: z.infer<typeof initOptionsSchema> & {
    skipPreflight?: boolean
  }
) {
  const copyFilesSpinner = spinner(`Copying files to your project.`).start()
  try {
    const projectInfo = await getProjectInfo(options.cwd)
    const registry = new GithubRegistry(options, projectInfo)
    await registry.fetchAndWriteFiles()
    copyFilesSpinner?.succeed("Files copied to your project.")
  } catch (error: any) {
    copyFilesSpinner?.fail()
    logger.error("Error fetching file tree:", error.message)
    process.exit(1)
  }
}

async function apiVerification() {
  const verificationSpinner = spinner("Verifying API key...")
  const options = await prompts([
    {
      type: "text",
      name: "email",
      message: "Please enter your email:",
      validate: (value) =>
        value ? true : "Email cannot be empty, please re-enter:",
    },
    {
      type: "invisible",
      name: "apiKey",
      message: `Please enter your ${highlighter.info("admin-boil API key")}:`,
      validate: (value) =>
        value ? true : "API key cannot be empty, please re-enter:",
    },
  ])

  verificationSpinner?.start()

  const { apiKey, email } = options

  if (!apiKey || !email) {
    logger.error("API key or email not provided.")
    process.exit(1)
  }

  if (apiKey === "\x16" || email === "\x16") {
    logger.error("API key or email not entered properly.")
    process.exit(1)
  }

  let status = false

  try {
    const api_response = await admin_boilInstance.post("/verify-api-key", {
      apiKey,
      email,
    })
    status = api_response.status === 200
    verificationSpinner.succeed("API key verified successfully.")
  } catch (error) {
    verificationSpinner?.fail("Error verifying API key.")
    if (axios.isAxiosError(error)) {
      // Axios-specific error handling
      if (error.response) {
        // Server responded with a status code outside the 2xx range
        console.error("Error Status Code:", error.response.status)
        console.error("Error Response Data:", error.response.data)
      } else if (error.request) {
        // No response was received after the request was sent
        console.error("No response received:", error.request)
      } else {
        // Error occurred during setting up the request
        console.error("Error Message:", error.message)
      }
    } else {
      // Non-Axios error (could be a different kind of error)
      console.error("Unexpected Error:", error)
    }
  }

  return { ok: status }
}
