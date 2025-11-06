/** @type {import('jest').Config} */
module.exports = {
  displayName: 'LuckyMartTJ Unit Tests',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  
  // 测试文件模式
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.(js|jsx|ts|tsx)',
    '<rootDir>/src/**/*.(test|spec).(js|jsx|ts|tsx)'
  ],
  
  // 模块解析
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1'
  },
  
  // 文件转换配置
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true
        },
        target: 'es2020'
      }
    }],
    '^.+\\.(css|scss|sass|less)$': 'jest-transform-stub',
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': 'jest-transform-stub'
  },
  
  // 模块文件扩展名
  moduleFileExtensions: [
    'js',
    'jsx',
    'ts',
    'tsx',
    'json'
  ],
  
  // 忽略转换的模块
  transformIgnorePatterns: [
    'node_modules/(?!(@supabase|@twa-dev)/)',
  ],
  
  // 覆盖率配置
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!src/types/**',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/main.tsx',
    '!src/vite-env.d.ts'
  ],
  
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
    'cobertura'
  ],
  
  coverageDirectory: 'coverage',
  
  // 全局变量
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  
  // 清除模拟
  clearMocks: true,
  restoreMocks: true,
  
  // 测试超时
  testTimeout: 10000,
  
  // 错误处理
  errorOnDeprecated: true,
  
  // 详细输出
  verbose: true,
  
  // 最大并发数
  maxConcurrency: 10,
  
  // 监视模式设置
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // 测试结果处理器
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './test-reports/html',
        filename: 'jest-report.html',
        openReport: false,
        pageTitle: 'LuckyMartTJ 单元测试报告',
        logoImgPath: undefined,
        hideIcon: false,
        expand: false,
        dateFormat: 'yyyy/mm/dd HH:MM:ss'
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './test-reports/junit',
        outputName: 'jest-junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: false,
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}'
      }
    ]
  ],
  
  // 自定义匹配器
  setupFiles: [
    '<rootDir>/src/test/jest.polyfills.js'
  ],
  
  // 模拟模块
  moduleNameMapping: {
    // Mock static assets
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/src/test/__mocks__/fileMock.js'
  },
  
  // 预设环境变量
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  }
}