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
import { BottomNavigation } from './components/navigation/BottomNavigation'
import './App.css'

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