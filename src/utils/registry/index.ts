import path from "path"
import fs from "fs"
import { initOptionsSchema } from "@/src/commands/init"
import { z } from "zod"
import * as ERRORS from "@/src/utils/errors"
import axios from "axios"

class GithubRegistry {
  private OWNER
  private REPO
  private branch
  private OPTIONS: z.infer<typeof initOptionsSchema>
  private PROJECT_INFO: any
  private GITHUB_API_URL = "https://api.github.com"
  private githubInstance

  private sourceFiles = [
    "app/dashboard",
    "app/globals.css",
    "components",
    "config",
    "drizzle",
    "hooks",
    "lib",
    "drizzle.config.ts",
  ]

  public errors: Record<string, boolean>

  constructor(
    options: z.infer<typeof initOptionsSchema>,
    projectInfo: any,
    user: { email: string; plan: string; github_key: string }
  ) {
    this.OWNER = "i-see-pixels"
    this.REPO = "admin-boil"
    this.branch = user.plan === "basic" ? "basic" : "main"
    this.OPTIONS = options
    this.PROJECT_INFO = projectInfo
    this.errors = {}

    this.githubInstance = axios.create({
      baseURL: this.GITHUB_API_URL,
      headers: {
        Authorization: `Bearer ${user.github_key}`,
        Accept: "application/json",
      },
    })
  }

  private isExcluded(path: string, exclude: string[]): boolean {
    return exclude.some((excluded) => path.startsWith(excluded))
  }

  async fetchFileTree(path = "", exclude: string[] = []): Promise<any[]> {
    const { data } = await this.githubInstance.get(
      `/repos/${this.OWNER}/${this.REPO}/contents/${path}?ref=${this.branch}`
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
      const { data } = await this.githubInstance.get(file.download_url, {
        responseType: "stream",
      })

      data.pipe(writer)

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
    for (const sourceFile of this.sourceFiles) {
      const files = await this.fetchFileTree(sourceFile, excludeFiles)

      for (const file of files) {
        if (file.type === "file") {
          await this.downloadAndSaveFile(file)
        }
      }
    }
  }

  async fetchFileContent(filePath: string): Promise<string> {
    const { data } = await this.githubInstance.get(
      `/repos/${this.OWNER}/${this.REPO}/contents/${filePath}?ref=${this.branch}`
    )
    return data.content
  }
}

export default GithubRegistry
