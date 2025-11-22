

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { Layout } from './components/layout/Layout'
import HomePage from './pages/HomePage'
import LotteryPage from './pages/LotteryPage'
import LotteryDetailPage from './pages/LotteryDetailPage'
import WalletPage from './pages/WalletPage'
import ProfilePage from './pages/ProfilePage'
import BotPage from './pages/BotPage'
import MonitoringPage from './pages/MonitoringPage'
import OrderPage from './pages/OrderPage'
import NotificationPage from './pages/NotificationPage'
import LotteryResultPage from './pages/LotteryResultPage'
import NotFoundPage from './pages/NotFoundPage'
import InvitePage from './pages/InvitePage'
import ShowoffPage from './pages/ShowoffPage'
import ShowoffCreatePage from './pages/ShowoffCreatePage'
import MarketPage from './pages/MarketPage'
import MarketCreatePage from './pages/MarketCreatePage'
import MyTicketsPage from './pages/MyTicketsPage'
import MyPrizesPage from './pages/MyPrizesPage'
import SettingsPage from './pages/SettingsPage'
import ProfileEditPage from './pages/ProfileEditPage'
import DepositPage from './pages/DepositPage'
import WithdrawPage from './pages/WithdrawPage'
import ExchangePage from './pages/ExchangePage'

import './App.css'



function App() {
  return (
    <Router>
        <div className="min-h-screen bg-gray-50">
          <Layout>
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