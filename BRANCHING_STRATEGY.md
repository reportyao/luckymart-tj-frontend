# 分支管理策略 (Git Flow 简化版)

为了规范开发流程，确保代码质量和环境稳定，我们采用 Git Flow 的简化版策略。所有开发人员必须遵循此策略。

## 核心分支

| 分支名 | 用途 | 稳定性 | 部署环境 |
| :--- | :--- | :--- | :--- |
| `main` | **正式环境分支** | ✅ 最高 | 生产服务器 (tezbarakat.com) |
| `develop` | **开发和测试分支** | ⚠️ 开发中 | 测试服务器 (staging.tezbarakat.com) |

## 工作流程

### 1. 新功能开发

- **起点**：从 `develop` 分支创建新的功能分支。
- **命名**：`feature/<功能名>` (例如: `feature/user-profile`)
- **命令**：
  ```bash
  git checkout develop
  git pull
  git checkout -b feature/user-profile
  ```

### 2. Bug 修复

- **起点**：从 `develop` 分支创建修复分支。
- **命名**：`fix/<问题描述>` (例如: `fix/login-button-bug`)
- **命令**：
  ```bash
  git checkout develop
  git pull
  git checkout -b fix/login-button-bug
  ```

### 3. 完成开发/修复

- **合并**：将功能或修复分支合并回 `develop` 分支。
- **方式**：通过 GitHub 创建 Pull Request (PR)。
- **流程**：
  1.  推送到远程：`git push origin feature/user-profile`
  2.  在 GitHub 创建 PR，目标分支为 `develop`。
  3.  **必须**进行代码审查 (Code Review)。
  4.  审查通过后，合并 PR。

### 4. 发布到正式环境

- **时机**：当 `develop` 分支经过充分测试，确认稳定后。
- **操作**：将 `develop` 分支合并到 `main` 分支。
- **方式**：通过 GitHub 创建 Pull Request (PR)。
- **流程**：
  1.  在 GitHub 创建 PR，目标分支为 `main`。
  2.  PR 标题格式：`release: v1.2.0` (版本号可选)
  3.  进行最终审查。
  4.  合并 PR 到 `main`。
  5.  `main` 分支的更新会自动触发生产环境部署。

## 紧急修复 (Hotfix)

- **场景**：生产环境出现紧急 Bug 需要立即修复。
- **流程**：
  1.  从 `main` 分支创建 hotfix 分支：`git checkout -b hotfix/critical-bug main`
  2.  修复并提交代码。
  3.  **同时合并回 `main` 和 `develop`**：
     ```bash
     # 合并到 main
     git checkout main
     git merge hotfix/critical-bug
     git push

     # 合并到 develop
     git checkout develop
     git merge hotfix/critical-bug
     git push
     ```

## 总结

- **绝不**直接向 `main` 或 `develop` 分支推送代码。
- 所有合并都必须通过 Pull Request 和代码审查。
- `main` 分支代表了生产环境的稳定状态。
- `develop` 分支是所有新功能的集成和修复的集结点。
