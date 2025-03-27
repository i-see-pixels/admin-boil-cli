import axios from "axios"

export const admin_boilInstance = axios.create({
  baseURL: "https://admin-boil.vercel.app/api",
  headers: {
    Accept: "application/json",
  },
})
