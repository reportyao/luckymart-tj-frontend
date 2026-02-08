import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Vite 插件：给所有资源添加时间戳查询参数，并在 HTML 中添加随机 ID
export default function timestampPlugin() {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const buildTime = new Date().toISOString();
  
  return {
    name: 'vite-plugin-timestamp',
    buildStart() {
      // 自动更新 public/version.json 的 buildTime
      try {
        const versionPath = resolve(process.cwd(), 'public/version.json');
        const versionData = JSON.parse(readFileSync(versionPath, 'utf-8'));
        versionData.buildTime = buildTime;
        writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n');
        console.log(`[timestamp] Updated version.json buildTime: ${buildTime}`);
      } catch (e) {
        console.warn('[timestamp] Failed to update version.json:', e.message);
      }
    },
    transformIndexHtml(html) {
      // 给所有 script 和 link 标签添加时间戳
      let result = html
        .replace(
          /(<script[^>]+src=")([^"]+)(")/g,
          `$1$2?v=${timestamp}$3`
        )
        .replace(
          /(<link[^>]+href=")([^"]+)(")/g,
          `$1$2?v=${timestamp}$3`
        );
      
      // 替换 __BUILD_TIME__ 和 __RANDOM_ID__ 占位符
      result = result
        .replace(/__BUILD_TIME__/g, buildTime)
        .replace(/__RANDOM_ID__/g, randomId);
      
      return result;
    }
  };
}
