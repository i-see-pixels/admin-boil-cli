import path from "path"
import fs from "fs"
import { githubInstance } from "../axiosinstance"
import { initOptionsSchema } from "@/src/commands/init"
import { z } from "zod"
import * as ERRORS from "@/src/utils/errors"

class GithubRegistry {
  private OWNER
  private REPO
  private EXCLUDED_DIRS
  private OPTIONS: z.infer<typeof initOptionsSchema>
  private PROJECT_INFO: any

  public errors: Record<string, boolean>

  constructor(options: z.infer<typeof initOptionsSchema>, projectInfo: any) {
    this.OWNER = "i-see-pixels"
    this.REPO = "admin-boil"
    this.EXCLUDED_DIRS = ["components/ui"]
    this.OPTIONS = options
    this.PROJECT_INFO = projectInfo
    this.errors = {}
  }

  private isExcluded(path: string): boolean {
    return this.EXCLUDED_DIRS.some((excludedDir) =>
      path.startsWith(excludedDir)
    )
  }

  async fetchFileTree(path = ""): Promise<any[]> {
    const { data } = await githubInstance.get(
      `/repos/${this.OWNER}/${this.REPO}/contents/${path}`
    )
    const files: any[] = []

    for (const item of data) {
      if (item.type === "dir" && this.isExcluded(item.path)) {
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

  async downloadAndSaveFile(file: any, targetDir = process.cwd()) {
    if (!file.download_url) {
      this.errors[ERRORS.GITHUB_DOWNLOAD_URL_NOT_FOUND] = true
      return
    }

    try {
      const localFilePath = this.getTargetPath(file.path, targetDir)
      const directory = path.dirname(localFilePath)

      // Ensure the directory exists
      fs.mkdirSync(directory, { recursive: true })

      // Save the file
      const writer = fs.createWriteStream(localFilePath)
      const { data } = await githubInstance.get(file.download_url, {
        responseType: "stream",
      })

      data.pipe(writer)

      console.log(`Downloaded: ${file.path}`)

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
    const files = await this.fetchFileTree()

    for (const file of files) {
      if (file.type === "file") {
        await this.downloadAndSaveFile(file)
      }
    }
  }
}

export default GithubRegistry
