import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Vite 插件：构建时更新 version.json 的 buildTime，并替换 HTML 中的占位符。
 * 
 * 注意：不再给资源 URL 添加 ?v=timestamp 查询参数。
 * Vite 构建会自动为所有输出文件名添加内容哈希（如 index-Vjnf1_2r.js），
 * 这是更优的缓存失效策略。查询参数会破坏浏览器的长期缓存能力，
 * 导致用户每次访问都重新下载所有资源。
 */
export default function timestampPlugin() {
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
      // 仅替换 __BUILD_TIME__ 占位符（用于 HTML 注释中的构建时间标记）
      return html.replace(/__BUILD_TIME__/g, buildTime);
    }
  };
}
