import axios from 'axios'

function normalizeUrl(value: string | undefined, fallback: string) {
  return (value || fallback).replace(/\/$/, '')
}

export const API_BASE_URL = normalizeUrl(import.meta.env.VITE_API_URL, 'http://localhost:4000')
export const SOCKET_URL = normalizeUrl(import.meta.env.VITE_SOCKET_URL, API_BASE_URL)

export const api = axios.create({
  baseURL: API_BASE_URL,
})
