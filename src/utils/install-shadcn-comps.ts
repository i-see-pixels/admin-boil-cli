import { ChildProcess, spawn } from "child_process"
import GithubRegistry from "./registry"
import { initOptionsSchema } from "../commands/init"
import { z } from "zod"
import fs from "fs-extra"
import { spinner } from "./spinner"
import path from "path"
import { logger } from "./logger"
import { highlighter } from "./highlighter"

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx"

export async function installShadcnComps(
  options: z.infer<typeof initOptionsSchema>,
  projectInfo: any,
  githubRepo: GithubRegistry
) {
  const installSpinner = spinner("Installing shadcn components...\n").start()
  try {
    const files_repo = await githubRepo.fetchFileTree("components/ui")

    const components_repo = (await files_repo).map((file) =>
      file.name.replace(".tsx", "")
    )

    const componentsDir = path.join(
      options.cwd,
      `${projectInfo.isSrcDir ? "src/" : ""}components/ui`
    )

    await fs.ensureDir(componentsDir)

    const files_cwd = await fs.readdir(componentsDir)

    const components_cwd = files_cwd.map((file) => file.replace(".tsx", ""))

    const components_to_add = components_repo.filter(
      (component) => !components_cwd.includes(component)
    )

    if (components_to_add.length != 0) {
      await runShadcnAddCommand(components_to_add)
    }

    installSpinner?.succeed()

    for (const component of components_to_add) {
      logger.info(`- Added ${highlighter.info(component)}`)
    }
  } catch (error) {
    installSpinner?.fail("Failed to install shadcn components.")
    logger.error((error as Error).message)
    process.exit(1)
  }
}

async function runShadcnAddCommand(components: string[]) {
  return new Promise<void>((resolve, reject) => {
    const process: ChildProcess = spawn(
      `${npxCmd} shadcn@latest add ${components.join(" ")} -s`,
      {
        shell: true,
        stdio: ["pipe", "inherit", "inherit"],
      }
    )

    // Function to handle input stream responses
    const respondToPrompts = (output: string) => {
      if (output.includes("How would you like to proceed?")) {
        process.stdin?.write("\n")
      } else if (output.includes("overwrite")) {
        process.stdin?.write("n\n")
      }
    }

    // Listen for data from stdout
    process.stdout?.on("data", (data: Buffer) => {
      const output = data.toString()
      respondToPrompts(output)
    })

    process.on("close", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(
          new Error(
            `Failed to add component ${components.join(
              ", "
            )}. Exit code: ${code}`
          )
        )
      }
    })

    process.on("error", (err) => {
      reject(err)
    })
  })
}
