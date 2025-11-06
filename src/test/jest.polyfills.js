// Jest polyfills for missing browser APIs
import 'whatwg-fetch'
import { TextEncoder, TextDecoder } from 'util'

// Polyfill for TextEncoder/TextDecoder
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Polyfill for performance.now()
if (!global.performance) {
  global.performance = {}
}

if (!global.performance.now) {
  global.performance.now = () => Date.now()
}

// Polyfill for requestAnimationFrame
global.requestAnimationFrame = (callback) => {
  return setTimeout(callback, 0)
}

global.cancelAnimationFrame = (id) => {
  clearTimeout(id)
}

// Polyfill for URL
if (!global.URL) {
  global.URL = require('url').URL
}

// Polyfill for URLSearchParams
if (!global.URLSearchParams) {
  global.URLSearchParams = require('url').URLSearchParams
}

// Polyfill for AbortController
if (!global.AbortController) {
  global.AbortController = require('abort-controller').AbortController
  global.AbortSignal = require('abort-controller').AbortSignal
}

// Polyfill for structuredClone (Node.js < 17)
if (!global.structuredClone) {
  global.structuredClone = (obj) => {
    return JSON.parse(JSON.stringify(obj))
  }
}

// Mock for Web Crypto API
if (!global.crypto) {
  const { webcrypto } = require('crypto')
  global.crypto = webcrypto
}

// Mock for localStorage/sessionStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => store[key] = value.toString(),
    removeItem: (key) => delete store[key],
    clear: () => store = {},
    length: () => Object.keys(store).length,
    key: (index) => Object.keys(store)[index] || null
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock
})