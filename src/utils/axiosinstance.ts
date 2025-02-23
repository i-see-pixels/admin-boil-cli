import axios from "axios"

export const admin_boilInstance = axios.create({
  baseURL: "http://localhost:3000/api",
  headers: {
    Accept: "application/json",
  },
})
