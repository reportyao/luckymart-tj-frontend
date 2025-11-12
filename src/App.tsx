import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { UserProvider } from './contexts/UserContext'
import { Layout } from './components/layout/Layout'
import HomePage from './pages/HomePage'
import LotteryPage from './pages/LotteryPage'
import WalletPage from './pages/WalletPage'
import ProfilePage from './pages/ProfilePage'
import BotPage from './pages/BotPage'
import MonitoringPage from './pages/MonitoringPage'
import OrderPage from './pages/OrderPage'
import NotificationPage from './pages/NotificationPage'
import LotteryResultPage from './pages/LotteryResultPage'
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
import { BottomNavigation } from './components/navigation/BottomNavigation'
import './App.css'

// Admin Dashboard Pages - Moved to src/pages/admin/ for future separation
// These pages will be part of a separate admin backend project
// import Dashboard from './pages/admin/Dashboard'
// import Users from './pages/admin/Users'
// import Lotteries from './pages/admin/Lotteries'
// import LotteryForm from './pages/admin/LotteryForm'
// import DepositReview from './pages/admin/DepositReview'
// import WithdrawalReview from './pages/admin/WithdrawalReview'
// import PaymentConfig from './pages/admin/PaymentConfig'
// import ShippingManagement from './pages/admin/ShippingManagement'
// import UserDetail from './pages/admin/UserDetail'
// import Orders from './pages/admin/Orders'
// import ShowoffReview from './pages/admin/ShowoffReview'
// import ResaleManagement from './pages/admin/ResaleManagement'
// import AuditLogs from './pages/admin/AuditLogs'

function App() {
  return (
    <UserProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/lottery" element={<LotteryPage />} />
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
              
              {/* Admin Dashboard Routes - Disabled for user frontend */}
              {/* These routes are moved to a separate admin backend project */}
              {/* <Route path="/admin" element={<Dashboard />} /> */}
              {/* <Route path="/admin/dashboard" element={<Dashboard />} /> */}
              {/* <Route path="/admin/users" element={<Users />} /> */}
              {/* <Route path="/admin/users/:id" element={<UserDetail />} /> */}
              {/* <Route path="/admin/lotteries" element={<Lotteries />} /> */}
              {/* <Route path="/admin/lotteries/new" element={<LotteryForm />} /> */}
              {/* <Route path="/admin/lotteries/:id" element={<LotteryForm />} /> */}
              {/* <Route path="/admin/deposit-review" element={<DepositReview />} /> */}
              {/* <Route path="/admin/withdrawal-review" element={<WithdrawalReview />} /> */}
              {/* <Route path="/admin/payment-config" element={<PaymentConfig />} /> */}
              {/* <Route path="/admin/shipping-management" element={<ShippingManagement />} /> */}
              {/* <Route path="/admin/orders" element={<Orders />} /> */}
              {/* <Route path="/admin/showoff-review" element={<ShowoffReview />} /> */}
              {/* <Route path="/admin/resale-management" element={<ResaleManagement />} /> */}
              {/* <Route path="/admin/audit-logs" element={<AuditLogs />} /> */}
            </Routes>
            
            <BottomNavigation />
          </Layout>
          
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#363636',
                color: '#fff',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '14px',
                maxWidth: '320px',
              },
              success: {
                style: {
                  background: '#10B981',
                },
              },
              error: {
                style: {
                  background: '#EF4444',
                },
              },
            }}
          />
        </div>
      </Router>
    </UserProvider>
  )
}

export default App