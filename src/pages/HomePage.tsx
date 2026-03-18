import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '../contexts/UserContext';
import { useInviteStats } from '../hooks/useInviteStats';
import { Lottery } from '../lib/supabase';
import { PurchaseModal } from '../components/lottery/PurchaseModal';
import { useSupabase } from '../contexts/SupabaseContext';
import { SafeMotion } from '../components/SafeMotion';
import { ProductList } from '../components/home/ProductList';
import { StarIcon } from '@heroicons/react/24/outline';
import BannerCarousel from '../components/BannerCarousel';
import toast from 'react-hot-toast';
import { useLotteries } from '../hooks/useHomeData';


const HomePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, profile, wallets, isLoading: userLoading, refreshWallets } = useUser();
  const { lotteryService } = useSupabase();
  const { stats: inviteStats } = useInviteStats();
  
  // 使用 react-query hooks 获取数据（自动缓存、重试、后台刷新）
  const {
    data: lotteries = [],
    isLoading: isLoadingLotteries,
    refetch: refetchLotteries,
  } = useLotteries();

  const nav = useNavigate();

  // 处理 Telegram start_param 重定向（仅在首次挂载时执行）
  useEffect(() => {
    const checkStartParam = () => {
      const WebApp = (window as any).Telegram?.WebApp || (window as any).__TELEGRAM_WEB_APP__;
      
      if (!WebApp) {
        console.log('[HomePage] Telegram SDK not loaded yet, waiting...');
        return false;
      }
      
      const startParam = WebApp.initDataUnsafe?.start_param;
      console.log('[HomePage] Checking start_param:', startParam);
      
      if (startParam) {
        console.log('[HomePage] Found start_param:', startParam);
        
        // 1. 拼团详情: gb_{productId} - 保留路由兼容，避免死链
        if (startParam.startsWith('gb_')) {
          const productId = startParam.replace('gb_', '');
          console.log('[HomePage] Group buy link received, redirecting to home');
          // 拼团已隐藏，重定向到首页
        }
        // 2. 拼团结果/加入: gbs_{sessionId} - 保留路由兼容
        else if (startParam.startsWith('gbs_')) {
          const sessionId = startParam.replace('gbs_', '');
          console.log('[HomePage] Group buy session link received, redirecting to home');
          // 拼团已隐藏，重定向到首页
        }
        // 3. 商城详情: lt_{lotteryId}
        else if (startParam.startsWith('lt_')) {
          const lotteryId = startParam.replace('lt_', '');
          console.log('[HomePage] Redirecting to lottery detail:', lotteryId);
          nav(`/lottery/${lotteryId}`, { replace: true });
        }
        // 4. 晒单详情: so_{showoffId}
        else if (startParam.startsWith('so_')) {
          const showoffId = startParam.replace('so_', '');
          console.log('[HomePage] Redirecting to showoff detail:', showoffId);
          nav(`/showoff`, { replace: true });
        }
        // 5. 邀请码: 直接是邀请码字符串（如 LMBDYIHI）
        else {
          console.log('[HomePage] Found referral code:', startParam);
          // 邀请码已在 UserContext 中处理，这里不需要额外操作
        }
      } else {
        console.log('[HomePage] No start_param found');
      }
      
      return true;
    };
    
    // 立即尝试检查
    if (!checkStartParam()) {
      const timer = setTimeout(() => {
        checkStartParam();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [nav]);

  const [selectedLottery, setSelectedLottery] = useState<Lottery | null>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  const handlePurchaseLottery = (lottery: Lottery) => {
    setSelectedLottery(lottery);
    setIsPurchaseModalOpen(true);
  };

  const handlePurchaseConfirm = async (lotteryId: string, quantity: number) => {
    try {
      await lotteryService.purchaseTickets(lotteryId, quantity);
      toast.success(t('lottery.purchaseSuccess'));
      await refetchLotteries();
      await refreshWallets();
    } catch (error: any) {
      toast.error(error.message || t('error.networkError'));
    } finally {
      setIsPurchaseModalOpen(false);
      setSelectedLottery(null);
    }
  };

  const handleRefreshWallets = async () => {
    await refreshWallets();
    toast.success(t('wallet.balanceUpdated'));
  };

  // 转换商城数据格式用于列表
  const lotteryListProducts = lotteries.map(l => ({
    id: l.id,
    type: 'lottery' as const,
    image_url: l.image_url,
    price: l.ticket_price,
    title_i18n: l.title_i18n as Record<string, string> | null,
    name_i18n: l.name_i18n as Record<string, string> | null,
    sold_tickets: l.sold_tickets,
    total_tickets: l.total_tickets,
    status: l.status,
    created_at: l.created_at,
  }));

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <SafeMotion
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <StarIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.welcome')}</h1>
          <p className="text-gray-600 mb-6">{t('auth.description')}</p>
          <p className="text-sm text-gray-500">{t('auth.pleaseLogin')}</p>
        </SafeMotion>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gray-50">
      {/* Banner广告位 */}
      <div className="px-4 pt-4">
        <BannerCarousel />
      </div>

      {/* 商城商品完整列表 - 移除拼团模块，直接展示商城商品 */}
      <ProductList
        title={t('home.lotteryProducts')}
        products={lotteryListProducts}
        isLoading={isLoadingLotteries}
        emptyText={t('home.noLotteries')}
        linkPrefix="/lottery"
      />

      {/* 购买模态框 */}
      <PurchaseModal
        lottery={selectedLottery}
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onConfirm={handlePurchaseConfirm}
      />
    </div>
  );
};

export default HomePage;
