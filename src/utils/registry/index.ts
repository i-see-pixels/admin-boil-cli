import path from "path"
import fs from "fs"
import { githubInstance } from "../axiosinstance"
import { initOptionsSchema } from "@/src/commands/init"
import { z } from "zod"
import * as ERRORS from "@/src/utils/errors"

// const filePaths = [
//   { source: "components", target: "components" },
//   { source: "config", target: "config" },
//   { source: "lib", target: "lib" },
//   { source: "utils", target: "utils" },
//   { source: "hooks", target: "hooks" },
//   { source: "drizzle", target: "drizzle" },
//   { source: "drizzle.config.ts", target: "drizzle.config.ts" },
//   { source: "app/dashboard", target: "app/dashboard" },
//   // middleware.ts file outside src if isSrcDir true
// ]

const sourceFiles = [
  "components",
  "config",
  "lib",
  "utils",
  "hooks",
  "drizzle",
  "app/dashboard",
  "drizzle.config.ts",
  "middleware.ts",
]

class GithubRegistry {
  private OWNER
  private REPO
  private OPTIONS: z.infer<typeof initOptionsSchema>
  private PROJECT_INFO: any

  public errors: Record<string, boolean>

  constructor(options: z.infer<typeof initOptionsSchema>, projectInfo: any) {
    this.OWNER = "i-see-pixels"
    this.REPO = "admin-boil"
    this.OPTIONS = options
    this.PROJECT_INFO = projectInfo
    this.errors = {}
  }

  private isExcluded(path: string, exclude: string[]): boolean {
    return exclude.some((excluded) => path.startsWith(excluded))
  }

  async fetchFileTree(path = "", exclude: string[] = []): Promise<any[]> {
    const { data } = await githubInstance.get(
      `/repos/${this.OWNER}/${this.REPO}/contents/${path}`
    )
    const files: any[] = []

    if (!Array.isArray(data)) {
      files.push(data)
      return files
    }

    for (const item of data) {
      if (this.isExcluded(item.path, exclude)) {
        continue
      }
      files.push(item)

      // If the item is a directory, fetch its contents recursively
      if (item.type === "dir") {
        const subFiles = await this.fetchFileTree(item.path)
        files.push(...subFiles)
      }
    }

    return files
  }

  private getTargetPath(filePath: string, targetDir: string): string {
    return path.join(
      targetDir,
      this.PROJECT_INFO.isSrcDir ? "src" : "",
      filePath
    )
  }

  async downloadAndSaveFile(file: any) {
    if (!file.download_url) {
      this.errors[ERRORS.GITHUB_DOWNLOAD_URL_NOT_FOUND] = true
      return
    }

    try {
      const localFilePath = this.getTargetPath(file.path, this.OPTIONS.cwd)
      const directory = path.dirname(localFilePath)

      // Ensure the directory exists
      fs.mkdirSync(directory, { recursive: true })

      // Save the file
      const writer = fs.createWriteStream(localFilePath)
      const { data } = await githubInstance.get(file.download_url, {
        responseType: "stream",
      })

      data.pipe(writer)

      // console.log(`Downloaded: ${file.path}`)

      // Wait until the file is fully written
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve)
        writer.on("error", reject)
      })
    } catch (error: Error | any) {
      this.errors[ERRORS.GITHUB_DOWNLOAD_ERROR] = true
    }
  }

  async fetchAndWriteFiles() {
    const excludeFiles = ["components/ui", "lib/utils.ts"]
    for (const sourceFile of sourceFiles) {
      const files = await this.fetchFileTree(sourceFile, excludeFiles)

      for (const file of files) {
        if (file.type === "file") {
          await this.downloadAndSaveFile(file)
          // console.log(`Downloading: ${file.path}`)
        }
      }
    }
  }
}

export default GithubRegistry
