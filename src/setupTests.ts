import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './mocks/server'

// 启动 Mock Service Worker (MSW) 服务器
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// 在每次测试后重置所有请求处理程序，以便它们不会意外地影响其他测试
afterEach(() => server.resetHandlers())

// 在所有测试完成后关闭服务器
afterAll(() => server.close())
