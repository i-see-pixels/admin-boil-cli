import axios from "axios"

const GITHUB_API_URL = "https://api.github.com"
const apiKey =
  "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"

export const githubInstance = axios.create({
  baseURL: GITHUB_API_URL,
  headers: {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  },
})
