import axios from "axios"

export const admin_boilInstance = axios.create({
  baseURL: "https://admin-boil.dev/api",
  headers: {
    Accept: "application/json",
  },
})
