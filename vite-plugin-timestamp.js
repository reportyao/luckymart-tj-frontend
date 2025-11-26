// Vite 插件：给所有资源添加时间戳查询参数
export default function timestampPlugin() {
  const timestamp = Date.now();
  
  return {
    name: 'vite-plugin-timestamp',
    transformIndexHtml(html) {
      // 给所有 script 和 link 标签添加时间戳
      return html
        .replace(
          /(<script[^>]+src=")([^"]+)(")/g,
          `$1$2?v=${timestamp}$3`
        )
        .replace(
          /(<link[^>]+href=")([^"]+)(")/g,
          `$1$2?v=${timestamp}$3`
        );
    }
  };
}
