# 移动端优化指南

本文档详细说明了 TezBarakat TJ 前端项目的移动端优化实现。

## 📱 优化内容

### 1. 响应式设计

#### 断点定义
```typescript
xs: 320px   // 超小屏幕
sm: 640px   // 小屏幕
md: 768px   // 中等屏幕（平板）
lg: 1024px  // 大屏幕（桌面）
xl: 1280px  // 超大屏幕
2xl: 1536px // 最大屏幕
```

#### 使用方式

**方式1：使用 Tailwind CSS 类名**
```tsx
<div className="text-sm md:text-base lg:text-lg">
  响应式文本
</div>
```

**方式2：使用 useResponsive Hook**
```tsx
import { useResponsive } from '@/hooks/useResponsive'

function MyComponent() {
  const { isMobile, isTablet, isDesktop, screenWidth } = useResponsive()
  
  return (
    <div>
      {isMobile && <MobileLayout />}
      {isTablet && <TabletLayout />}
      {isDesktop && <DesktopLayout />}
    </div>
  )
}
```

**方式3：使用响应式容器组件**
```tsx
import { ResponsiveContainer, MobileOnly, DesktopOnly } from '@/components/ResponsiveContainer'

function MyComponent() {
  return (
    <>
      <MobileOnly>
        <div>仅在移动设备显示</div>
      </MobileOnly>
      <DesktopOnly>
        <div>仅在桌面显示</div>
      </DesktopOnly>
    </>
  )
}
```

### 2. 触摸交互

#### 支持的手势

**滑动手势**
```tsx
import { useSwipe } from '@/hooks/useTouch'

function Carousel() {
  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useSwipe(
    (direction) => {
      if (direction.direction === 'left') {
        // 向左滑动
      } else if (direction.direction === 'right') {
        // 向右滑动
      }
    },
    50 // 滑动距离阈值
  )

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      轮播内容
    </div>
  )
}
```

**长按手势**
```tsx
import { useLongPress } from '@/hooks/useTouch'

function LongPressButton() {
  const { handleTouchStart, handleTouchEnd, handleTouchMove } = useLongPress(
    () => {
      console.log('长按触发')
    },
    500 // 长按时长
  )

  return (
    <button
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      长按我
    </button>
  )
}
```

**双击手势**
```tsx
import { useDoubleTap } from '@/hooks/useTouch'

function DoubleTapZoom() {
  const { handleTouchEnd } = useDoubleTap(
    () => {
      console.log('双击')
    },
    300 // 双击间隔
  )

  return (
    <img
      src="image.jpg"
      onTouchEnd={handleTouchEnd}
    />
  )
}
```

**捏合缩放**
```tsx
import { usePinch } from '@/hooks/useTouch'

function PinchZoom() {
  const { handleTouchMove, handleTouchEnd } = usePinch((scale) => {
    console.log('缩放比例:', scale)
  })

  return (
    <div
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      捏合缩放内容
    </div>
  )
}
```

### 3. 性能优化

#### 防抖和节流

**防抖（Debounce）**
```tsx
import { useDebounce } from '@/hooks/usePerformance'

function SearchInput() {
  const handleSearch = useDebounce((query: string) => {
    // 执行搜索
    console.log('搜索:', query)
  }, 300)

  return (
    <input
      onChange={(e) => handleSearch(e.target.value)}
      placeholder="搜索..."
    />
  )
}
```

**节流（Throttle）**
```tsx
import { useThrottle } from '@/hooks/usePerformance'

function ScrollListener() {
  const handleScroll = useThrottle((e: React.UIEvent) => {
    console.log('滚动中...')
  }, 100)

  return (
    <div onScroll={handleScroll} style={{ height: '100vh', overflow: 'auto' }}>
      内容
    </div>
  )
}
```

#### 虚拟滚动

用于渲染大列表，只渲染可见区域的元素：

```tsx
import VirtualList from '@/components/VirtualList'

function LargeList() {
  const items = Array.from({ length: 10000 }, (_, i) => ({ id: i, name: `Item ${i}` }))

  return (
    <VirtualList
      items={items}
      itemHeight={50}
      containerHeight={600}
      renderItem={(item) => (
        <div className="p-4 border-b">
          {item.name}
        </div>
      )}
      onEndReached={() => {
        console.log('到达底部，加载更多')
      }}
    />
  )
}
```

#### 交叉观察器（Intersection Observer）

用于懒加载和无限滚动：

```tsx
import { useIntersectionObserver } from '@/hooks/usePerformance'

function LazyLoadSection() {
  const ref = useIntersectionObserver((isVisible) => {
    if (isVisible) {
      console.log('元素进入视口')
    }
  })

  return (
    <div ref={ref} className="p-4">
      内容
    </div>
  )
}
```

### 4. 代码分割和懒加载

#### 路由级别代码分割

```tsx
import { lazy, Suspense } from 'react'
import { createLazyRoute } from '@/utils/dynamicImport'

// 方式1：使用 lazy 和 Suspense
const HomePage = lazy(() => import('@/pages/HomePage'))

// 方式2：使用工具函数
const LotteryPage = createLazyRoute(() => import('@/pages/LotteryPage'))

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <HomePage />
          </Suspense>
        }
      />
      <Route path="/lottery" element={<LotteryPage.Component />} />
    </Routes>
  )
}
```

#### 组件级别代码分割

```tsx
import { lazyLoad } from '@/utils/dynamicImport'

const HeavyComponent = lazyLoad(
  () => import('@/components/HeavyComponent'),
  <div>加载中...</div>
)

function MyPage() {
  return <HeavyComponent />
}
```

#### 懒加载图片

```tsx
import LazyImage from '@/components/LazyImage'

function Gallery() {
  return (
    <div>
      <LazyImage
        src="image1.jpg"
        alt="图片1"
        width={400}
        height={300}
        onLoad={() => console.log('图片加载完成')}
      />
    </div>
  )
}
```

### 5. 弱网环境优化

#### 网络状态检测

```tsx
import { useNetworkStatus } from '@/hooks/usePerformance'

function OfflineIndicator() {
  const { isOnline, effectiveType } = useNetworkStatus()

  return (
    <div>
      {!isOnline && <div className="bg-red-500 text-white p-2">离线模式</div>}
      <div>网络类型: {effectiveType}</div>
    </div>
  )
}
```

#### 缓存管理

```tsx
import { cacheManager } from '@/utils/cache'

// 设置缓存
cacheManager.set('user-data', userData, {
  ttl: 1000 * 60 * 5, // 5分钟过期
  storage: 'local',
})

// 获取缓存
const cachedData = cacheManager.get('user-data', 'local')

// 删除缓存
cacheManager.remove('user-data', 'local')

// 清空所有缓存
cacheManager.clear('local')

// 获取缓存大小
const size = cacheManager.getSize('local')
```

#### 函数结果缓存

```tsx
import { memoize } from '@/utils/cache'

const expensiveCalculation = memoize(
  (a: number, b: number) => {
    console.log('计算中...')
    return a + b
  },
  { ttl: 1000 * 60 } // 1分钟过期
)

// 第一次调用会执行计算
expensiveCalculation(1, 2) // 输出: 计算中...

// 第二次调用会返回缓存结果
expensiveCalculation(1, 2) // 不输出计算中
```

## 🎯 最佳实践

### 1. 响应式设计最佳实践

- **移动优先**：从移动端开始设计，然后向上扩展
- **灵活布局**：使用 Flexbox 和 Grid 实现灵活布局
- **相对单位**：使用 rem/em 而不是 px
- **触摸友好**：按钮最小尺寸 44x44px
- **避免水平滚动**：在移动设备上避免水平滚动

### 2. 性能优化最佳实践

- **代码分割**：按路由和功能分割代码
- **懒加载**：延迟加载非关键资源
- **虚拟滚动**：大列表使用虚拟滚动
- **缓存策略**：合理使用缓存减少网络请求
- **防抖节流**：限制高频事件处理

### 3. 触摸交互最佳实践

- **反馈**：提供视觉反馈（按下、悬停等）
- **防误触**：增加触摸目标大小和间距
- **手势识别**：使用标准手势（滑动、长按等）
- **无障碍**：支持键盘导航和屏幕阅读器

### 4. 弱网优化最佳实践

- **检测网络**：监测网络状态和连接类型
- **渐进式加载**：优先加载关键内容
- **离线支持**：实现离线缓存和同步
- **压缩资源**：压缩图片、CSS、JavaScript
- **CDN 加速**：使用 CDN 加速资源传输

## 📊 性能指标

### 目标指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| FCP | < 1.8s | 首次内容绘制 |
| LCP | < 2.5s | 最大内容绘制 |
| CLS | < 0.1 | 累积布局偏移 |
| TTFB | < 600ms | 首字节时间 |
| 首屏加载 | < 3s | 首屏完全加载 |

### 测量工具

- **Lighthouse**：Chrome DevTools 内置
- **WebPageTest**：https://www.webpagetest.org/
- **GTmetrix**：https://gtmetrix.com/
- **PageSpeed Insights**：https://pagespeed.web.dev/

## 🔧 调试和测试

### Chrome DevTools

1. **设备模拟**：F12 → 点击设备图标 → 选择设备
2. **网络限流**：F12 → Network → 选择网络速度
3. **性能分析**：F12 → Performance → 录制和分析
4. **内存分析**：F12 → Memory → 拍摄堆快照

### 测试清单

- [ ] 在各种设备上测试（手机、平板、桌面）
- [ ] 测试各种网络速度（4G、3G、2G）
- [ ] 测试离线模式
- [ ] 测试触摸交互
- [ ] 测试无障碍功能
- [ ] 测试性能指标

## 📚 参考资源

- [MDN - 响应式设计](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [Web.dev - 性能优化](https://web.dev/performance/)
- [React - 代码分割](https://react.dev/reference/react/lazy)
- [Tailwind CSS - 响应式设计](https://tailwindcss.com/docs/responsive-design)
