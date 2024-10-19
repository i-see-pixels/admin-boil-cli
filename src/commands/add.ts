import { Command } from "commander"

export const add = new Command()
  .name("add")
  .description("Add a new component")
  .action(async () => {
    console.log("add")
  })
