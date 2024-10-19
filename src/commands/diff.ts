import { Command } from "commander"

export const diff = new Command()
  .name("diff")
  .description("Show diff between components")
  .action(async () => {
    console.log("diff")
  })
