import { lazy, Suspense } from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { DebugFloatingButton } from "./components/debug/DebugFloatingButton"
import { Layout } from "./components/layout/Layout"
import { queryClient } from "./lib/react-query"

// 路由级别代码分割 - 懒加载页面组件
const HomePage = lazy(() => import("./pages/HomePage"))
const LotteryPage = lazy(() => import("./pages/LotteryPage"))
const LotteryDetailPage = lazy(() => import("./pages/LotteryDetailPage"))
const LotteryResultPage = lazy(() => import("./pages/LotteryResultPage"))
const WalletPage = lazy(() => import("./pages/WalletPage"))
const ProfilePage = lazy(() => import("./pages/ProfilePage"))
const ProfileEditPage = lazy(() => import("./pages/ProfileEditPage"))
const BotPage = lazy(() => import("./pages/BotPage"))
const MonitoringPage = lazy(() => import("./pages/MonitoringPage"))
const OrderPage = lazy(() => import("./pages/OrderPage"))
const NotificationPage = lazy(() => import("./pages/NotificationPage"))
const InvitePage = lazy(() => import("./pages/InvitePage"))
const ShowoffPage = lazy(() => import("./pages/ShowoffPage"))
const ShowoffCreatePage = lazy(() => import("./pages/ShowoffCreatePage"))
const MarketPage = lazy(() => import("./pages/MarketPage"))
const MarketCreatePage = lazy(() => import("./pages/MarketCreatePage"))
const MyTicketsPage = lazy(() => import("./pages/MyTicketsPage"))
const MyPrizesPage = lazy(() => import("./pages/MyPrizesPage"))
const SettingsPage = lazy(() => import("./pages/SettingsPage"))
const DepositPage = lazy(() => import("./pages/DepositPage"))
const ExchangePage = lazy(() => import("./pages/ExchangePage"))
const WithdrawPage = lazy(() => import("./pages/WithdrawPage"))
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"))
const DebugPage = lazy(() => import("./pages/DebugPage"))

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <Layout>
            <Suspense fallback={<div>Loading...</div>}>
              <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/lottery" element={<LotteryPage />} />
              <Route path="/lottery/:id" element={<LotteryDetailPage />} />
              <Route path="/lottery/:id/result" element={<LotteryResultPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/deposit" element={<DepositPage />} />
              <Route path="/wallet/deposit" element={<DepositPage />} />
              <Route path="/withdraw" element={<WithdrawPage />} />
              <Route path="/wallet/withdraw" element={<WithdrawPage />} />
              <Route path="/exchange" element={<ExchangePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/bot" element={<BotPage />} />
              <Route path="/monitoring" element={<MonitoringPage />} />
              <Route path="/orders" element={<OrderPage />} />
              <Route path="/notifications" element={<NotificationPage />} />
              <Route path="/invite" element={<InvitePage />} />
              <Route path="/showoff" element={<ShowoffPage />} />
              <Route path="/showoff/create" element={<ShowoffCreatePage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/market/create" element={<MarketCreatePage />} />
              <Route path="/my-tickets" element={<MyTicketsPage />} />
              <Route path="/my-prizes" element={<MyPrizesPage />} />
              <Route path="/prizes" element={<MyPrizesPage />} />
              <Route path="/showoff/my" element={<ShowoffPage />} />
              <Route path="/market/my-resales" element={<MarketPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/debug" element={<DebugPage />} />
              <Route path="/profile/edit" element={<ProfileEditPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Layout>
        
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
          }}
        />
        
        <DebugFloatingButton />
      </div>
    </Router>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
  )
}

export default App
