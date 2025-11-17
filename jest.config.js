module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  
  // 模块别名映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // 测试设置
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  
  // 覆盖率收集
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/**/*.stories.tsx'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // TypeScript 配置
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx'
      }
    }
  }
}
