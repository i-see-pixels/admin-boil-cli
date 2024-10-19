import { Command } from "commander"
import prompts from "prompts"

export const init = new Command()
  .name("init")
  .description("Initialize an admin-boil project with selected options")
  .action(async () => {
    const response = await prompts({
      type: "select",
      name: "projectType",
      message: "Choose the type of project to initialize:",
      choices: [
        { title: "Dashboard", value: "dashboard" },
        { title: "API Only", value: "api-only" },
        { title: "Fullstack", value: "fullstack" },
      ],
    })

    if (response.projectType) {
      console.log(
        `You have chosen to initialize a ${response.projectType} project.`
      )
    } else {
      console.log("No option selected. Exiting.")
    }
  })
