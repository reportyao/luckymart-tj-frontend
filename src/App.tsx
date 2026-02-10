import { Suspense, lazy } from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { BotFollowModal, useBotFollowModal } from "./components/BotFollowModal"
import { Layout } from "./components/layout/Layout"
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
import GroupBuyListPage from "./pages/groupbuy/GroupBuyListPage"
import GroupBuyDetailPage from "./pages/groupbuy/GroupBuyDetailPage"
import MyGroupBuysPage from "./pages/groupbuy/MyGroupBuysPage"
import GroupBuyResultPage from "./pages/groupbuy/GroupBuyResultPage"
import FullPurchaseConfirmPage from "./pages/FullPurchaseConfirmPage"
import SpinLotteryPage from "./pages/SpinLotteryPage"
import AIPage from "./pages/AIPage"
import PendingPickupPage from "./pages/PendingPickupPage"
import SubsidyPlanPage from "./pages/SubsidyPlanPage"
import PromoterCenterPage from "./pages/PromoterCenterPage"

// 调试面板：生产环境中通过连续点击5次"我的"触发，懒加载以减少初始包体积
const DebugFloatingButton = lazy(() => import("./components/debug/DebugFloatingButton").then(m => ({ default: m.DebugFloatingButton })))
const DebugPage = lazy(() => import("./pages/DebugPage"))

// 开发工具：仅在开发环境下懒加载，不会打包进生产环境
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() => import("@tanstack/react-query-devtools").then(m => ({ default: m.ReactQueryDevtools })))
  : () => null

const MonitoringPage = import.meta.env.DEV
  ? lazy(() => import("./pages/MonitoringPage"))
  : () => <NotFoundPage />

function App() {
  const { showModal, closeModal, handleSuccess } = useBotFollowModal()

  return (
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
            <Route path="/subsidy-plan" element={<SubsidyPlanPage />} />
            <Route path="/bot" element={<BotPage />} />
            <Route path="/monitoring" element={<Suspense fallback={null}><MonitoringPage /></Suspense>} />
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
            <Route path="/promoter-center" element={<PromoterCenterPage />} />
            <Route path="/market/my-resales" element={<MarketPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/debug" element={<Suspense fallback={null}><DebugPage /></Suspense>} />
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
      
      <Suspense fallback={null}>
        <DebugFloatingButton />
      </Suspense>
      
      {/* Bot关注引导弹窗 */}
      {showModal && (
        <BotFollowModal
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
      </Router>
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </RealtimeNotificationsProvider>
  )
}

export default App
