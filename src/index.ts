#!/usr/bin/env node
import { init } from "@/src/commands/init"
import { Command } from "commander"

import packageJson from "../package.json"

process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))

async function main() {
  const program = new Command()
    .name("admin-boil")
    .description("add admin-boil dashboard to your project")
    .version(
      packageJson.version || "1.0.0",
      "-v, --version",
      "display the version number"
    )

  program.addCommand(init)

  program.parse()
}

main()
