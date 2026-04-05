import axios from 'axios'

function normalizeUrl(value: string | undefined, fallback: string) {
  return (value || fallback).replace(/\/$/, '')
}

function getDefaultApiUrl() {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:4000`
  }

  return 'http://localhost:4000'
}

export const API_BASE_URL = normalizeUrl(import.meta.env.VITE_API_URL, getDefaultApiUrl())
export const SOCKET_URL = normalizeUrl(import.meta.env.VITE_SOCKET_URL, API_BASE_URL)

export const api = axios.create({
  baseURL: API_BASE_URL,
})
