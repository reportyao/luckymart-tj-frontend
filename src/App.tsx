

import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { Layout } from './components/layout/Layout'


// 路由级别代码分割 - 懒加载页面组件
const HomePage = lazy(() => import('./pages/HomePage'))
const LotteryPage = lazy(() => import('./pages/LotteryPage'))
const LotteryDetailPage = lazy(() => import('./pages/LotteryDetailPage'))
const LotteryResultPage = lazy(() => import('./pages/LotteryResultPage'))
const WalletPage = lazy(() => import('./pages/WalletPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const ProfileEditPage = lazy(() => import('./pages/ProfileEditPage'))
const BotPage = lazy(() => import('./pages/BotPage'))
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'))
const OrderPage = lazy(() => import('./pages/OrderPage'))
const NotificationPage = lazy(() => import('./pages/NotificationPage'))
const InvitePage = lazy(() => import('./pages/InvitePage'))
const ShowoffPage = lazy(() => import('./pages/ShowoffPage'))
const ShowoffCreatePage = lazy(() => import('./pages/ShowoffCreatePage'))
const MarketPage = lazy(() => import('./pages/MarketPage'))
const MarketCreatePage = lazy(() => import('./pages/MarketCreatePage'))
const MyTicketsPage = lazy(() => import('./pages/MyTicketsPage'))
const MyPrizesPage = lazy(() => import('./pages/MyPrizesPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const DepositPage = lazy(() => import('./pages/DepositPage'))
const WithdrawPage = lazy(() => import('./pages/WithdrawPage'))
const ExchangePage = lazy(() => import('./pages/ExchangePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

// Loading 组件
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
)

import './App.css'



function App() {
  return (
    <Router>
        <div className="min-h-screen bg-gray-50">
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/lottery" element={<LotteryPage />} />
              <Route path="/lottery/:id" element={<LotteryDetailPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/bot" element={<BotPage />} />
              <Route path="/monitoring" element={<MonitoringPage />} />
              <Route path="/orders" element={<OrderPage />} />
              <Route path="/notifications" element={<NotificationPage />} />
              <Route path="/lottery/:id/result" element={<LotteryResultPage />} />
              <Route path="/invite" element={<InvitePage />} />
              <Route path="/showoff" element={<ShowoffPage />} />
              <Route path="/showoff/create" element={<ShowoffCreatePage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/market/create" element={<MarketCreatePage />} />
              <Route path="/lottery/:id/my-tickets" element={<MyTicketsPage />} />
              <Route path="/prizes" element={<MyPrizesPage />} />
              <Route path="/deposit" element={<DepositPage />} />
              <Route path="/withdraw" element={<WithdrawPage />} />
              <Route path="/exchange" element={<ExchangePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile/edit" element={<ProfileEditPage />} />
              <Route path="*" element={<NotFoundPage />} />

            </Routes>
            </Suspense>
          </Layout>
          
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              // 移除硬编码样式，使用默认或通过 CSS 变量控制
            }}
          />
        </div>
      </Router>
  )
}

export default App