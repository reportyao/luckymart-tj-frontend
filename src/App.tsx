import { Suspense } from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { DebugFloatingButton } from "./components/debug/DebugFloatingButton"
import { Layout } from "./components/layout/Layout"
import { queryClient } from "./lib/react-query"
import { RealtimeNotificationsProvider } from "./components/RealtimeNotificationsProvider"

// 静态导入所有页面组件（移除懒加载以提高页面切换速度）
import HomePage from "./pages/HomePage"
import LotteryPage from "./pages/LotteryPage"
import LotteryDetailPage from "./pages/LotteryDetailPage"
import LotteryResultPage from "./pages/LotteryResultPage"
import WalletPage from "./pages/WalletPage"
import ProfilePage from "./pages/ProfilePage"
import ProfileEditPage from "./pages/ProfileEditPage"
import BotPage from "./pages/BotPage"
import MonitoringPage from "./pages/MonitoringPage"
import OrderPage from "./pages/OrderPage"
import NotificationPage from "./pages/NotificationPage"
import InvitePage from "./pages/InvitePage"
import ShowoffPage from "./pages/ShowoffPage"
import ShowoffCreatePage from "./pages/ShowoffCreatePage"
import MarketPage from "./pages/MarketPage"
import MarketCreatePage from "./pages/MarketCreatePage"
import MyTicketsPage from "./pages/MyTicketsPage"
import MyPrizesPage from "./pages/MyPrizesPage"
import OrderManagementPage from "./pages/OrderManagementPage"
import OrderDetailPage from "./pages/OrderDetailPage"
import SettingsPage from "./pages/SettingsPage"
import DepositPage from "./pages/DepositPage"
import ExchangePage from "./pages/ExchangePage"
import WithdrawPage from "./pages/WithdrawPage"
import NotFoundPage from "./pages/NotFoundPage"
import DebugPage from "./pages/DebugPage"
import GroupBuyListPage from "./pages/groupbuy/GroupBuyListPage"
import GroupBuyDetailPage from "./pages/groupbuy/GroupBuyDetailPage"
import MyGroupBuysPage from "./pages/groupbuy/MyGroupBuysPage"
import GroupBuyResultPage from "./pages/groupbuy/GroupBuyResultPage"
import FullPurchaseConfirmPage from "./pages/FullPurchaseConfirmPage"
import SpinLotteryPage from "./pages/SpinLotteryPage"
import AIPage from "./pages/AIPage"
import PendingPickupPage from "./pages/PendingPickupPage"

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeNotificationsProvider>
        <Router>
        <div className="App">
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/lottery" element={<LotteryPage />} />
              <Route path="/lottery/:id" element={<LotteryDetailPage />} />
              <Route path="/lottery/:id/result" element={<LotteryResultPage />} />
              <Route path="/full-purchase-confirm/:lotteryId" element={<FullPurchaseConfirmPage />} />
              <Route path="/group-buy" element={<GroupBuyListPage />} />
              <Route path="/group-buy/:productId" element={<GroupBuyDetailPage />} />
              <Route path="/group-buy/result/:sessionId" element={<GroupBuyResultPage />} />
              <Route path="/my-group-buys" element={<MyGroupBuysPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/deposit" element={<DepositPage />} />
              <Route path="/wallet/deposit" element={<DepositPage />} />
              <Route path="/withdraw" element={<WithdrawPage />} />
              <Route path="/wallet/withdraw" element={<WithdrawPage />} />
              <Route path="/exchange" element={<ExchangePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/bot" element={<BotPage />} />
              <Route path="/monitoring" element={<MonitoringPage />} />
              <Route path="/orders" element={<OrderManagementPage />} />
              <Route path="/notifications" element={<NotificationPage />} />
              <Route path="/invite" element={<InvitePage />} />
              <Route path="/spin" element={<SpinLotteryPage />} />
              <Route path="/ai" element={<AIPage />} />
              <Route path="/showoff" element={<ShowoffPage />} />
              <Route path="/showoff/create" element={<ShowoffCreatePage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/market/create" element={<MarketCreatePage />} />
              <Route path="/my-tickets" element={<MyTicketsPage />} />
              <Route path="/my-prizes" element={<OrderManagementPage />} />
              <Route path="/prizes" element={<OrderManagementPage />} />
              <Route path="/orders-management" element={<OrderManagementPage />} />
              <Route path="/order-detail/:id" element={<OrderDetailPage />} />
              <Route path="/showoff/my" element={<ShowoffPage />} />
              <Route path="/market/my-resales" element={<MarketPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/debug" element={<DebugPage />} />
              <Route path="/profile/edit" element={<ProfileEditPage />} />
              <Route path="/pending-pickup" element={<PendingPickupPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/groupbuy/:productId" element={<GroupBuyDetailPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
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
      </RealtimeNotificationsProvider>
    </QueryClientProvider>
  )
}

export default App
