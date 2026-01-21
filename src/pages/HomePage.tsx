import React, { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '../contexts/UserContext';
import { useInviteStats } from '../hooks/useInviteStats';
import { Lottery, supabase } from '../lib/supabase';
import { PurchaseModal } from '../components/lottery/PurchaseModal';
import { useSupabase } from '../contexts/SupabaseContext';
import { LotteryCard } from '../components/lottery/LotteryCard';
import { SafeMotion } from '../components/SafeMotion';
import { ModulePreview } from '../components/home/ModulePreview';
import { ProductList } from '../components/home/ProductList';
import { ArrowRightIcon, StarIcon, TrophyIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import ReferralBanner from '../components/ReferralBanner';
import BannerCarousel from '../components/BannerCarousel';
import toast from 'react-hot-toast';

interface GroupBuyProduct {
  id: string;
  title: { zh: string; ru: string; tg: string };
  description: { zh: string; ru: string; tg: string };
  image_url: string;
  original_price: number;
  price_per_person: number;
  group_size: number;
  timeout_hours: number;
  active_sessions_count: number;
  created_at?: string;
}

const HomePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, profile, wallets, isLoading: userLoading, refreshWallets } = useUser();
  const { lotteryService } = useSupabase();
  const { stats: inviteStats } = useInviteStats();
  
  // 积分商城数据
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [isLoadingLotteries, setIsLoadingLotteries] = useState(true);
  
  // 拼团数据
  const [groupBuyProducts, setGroupBuyProducts] = useState<GroupBuyProduct[]>([]);
  const [isLoadingGroupBuy, setIsLoadingGroupBuy] = useState(true);

  // 加载积分商城数据
  const loadLotteries = useCallback(async () => {
    try {
      setIsLoadingLotteries(true);
      const data = await lotteryService.getActiveLotteries();
      // 按创建时间从新到旧排序
      const sortedLotteries = [...data].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setLotteries(sortedLotteries);
    } catch (error: any) {
      console.error('Failed to load lotteries:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoadingLotteries(false);
    }
  }, [t, lotteryService]);

  // 加载拼团数据
  const loadGroupBuyProducts = useCallback(async () => {
    try {
      setIsLoadingGroupBuy(true);
      const { data, error } = await supabase.functions.invoke('group-buy-list', {
        body: { type: 'products' },
      });

      if (error) throw error;
      if (data?.success) {
        // 按创建时间从新到旧排序
        const sortedProducts = [...data.data].sort((a: any, b: any) => {
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
        setGroupBuyProducts(sortedProducts);
      }
    } catch (error) {
      console.error('Failed to fetch group buy products:', error);
    } finally {
      setIsLoadingGroupBuy(false);
    }
  }, []);

  const nav = useNavigate();

  useEffect(() => {
    loadLotteries();
    loadGroupBuyProducts();

    // 处理 Telegram start_param 重定向
    const WebApp = (window as any).Telegram?.WebApp;
    const startParam = WebApp?.initDataUnsafe?.start_param;
    
    if (startParam) {
      console.log('[HomePage] Found start_param:', startParam);
      
      // 1. 拼团详情: gb_{productId}
      if (startParam.startsWith('gb_')) {
        const productId = startParam.replace('gb_', '');
        console.log('[HomePage] Redirecting to group buy product:', productId);
        nav(`/group-buy/${productId}`, { replace: true });
      }
      // 2. 拼团结果/加入: gbs_{sessionId}
      else if (startParam.startsWith('gbs_')) {
        const sessionId = startParam.replace('gbs_', '');
        console.log('[HomePage] Redirecting to group buy session:', sessionId);
        nav(`/group-buy/result/${sessionId}`, { replace: true });
      }
      // 3. 积分商城详情: lt_{lotteryId}
      else if (startParam.startsWith('lt_')) {
        const lotteryId = startParam.replace('lt_', '');
        console.log('[HomePage] Redirecting to lottery detail:', lotteryId);
        nav(`/lottery/${lotteryId}`, { replace: true });
      }
      // 4. 晒单详情: so_{showoffId}
      else if (startParam.startsWith('so_')) {
        const showoffId = startParam.replace('so_', '');
        console.log('[HomePage] Redirecting to showoff detail:', showoffId);
        nav(`/showoff`, { replace: true }); // 目前晒单详情在列表中，先跳到列表
      }
    }
  }, [loadLotteries, loadGroupBuyProducts, nav]);

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
      // 购买成功后刷新列表和钱包
      await loadLotteries();
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

  // 转换拼团商品数据格式用于预览
  const groupBuyPreviewProducts = groupBuyProducts.slice(0, 4).map(p => ({
    id: p.id,
    image_url: p.image_url,
    price: p.price_per_person,
    title_i18n: p.title,
  }));

  // 转换积分商城数据格式用于预览
  const lotteryPreviewProducts = lotteries.slice(0, 4).map(l => ({
    id: l.id,
    image_url: l.image_url,
    price: l.ticket_price,
    title_i18n: l.title_i18n as Record<string, string> | null,
    name_i18n: l.name_i18n as Record<string, string> | null,
  }));

  // 转换拼团商品数据格式用于列表
  const groupBuyListProducts = groupBuyProducts.map(p => ({
    id: p.id,
    type: 'groupbuy' as const,
    image_url: p.image_url,
    price: p.price_per_person,
    original_price: p.original_price,
    title_i18n: p.title,
    group_size: p.group_size,
    active_sessions_count: p.active_sessions_count,
    created_at: p.created_at || new Date().toISOString(),
  }));

  // 转换积分商城数据格式用于列表
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

      {/* 模块预览区域 */}
      <div className="px-4 mt-6 space-y-4">
        {/* 拼团模块预览 */}
        <ModulePreview
          title={t('home.groupBuy')}
          description={t('home.groupBuyDesc')}
          linkTo="/group-buy"
          linkText={t('home.viewAll')}
          products={groupBuyPreviewProducts}
          isLoading={isLoadingGroupBuy}
          gradientFrom="from-pink-500"
          gradientTo="to-purple-600"
          iconBgFrom="from-pink-400"
          iconBgTo="to-purple-500"
          icon={<UserGroupIcon className="w-5 h-5 text-white" />}
        />

        {/* 积分商城模块预览 */}
        <ModulePreview
          title={t('home.lottery')}
          description={t('home.lotteryDesc')}
          linkTo="/lottery"
          linkText={t('home.viewAll')}
          products={lotteryPreviewProducts}
          isLoading={isLoadingLotteries}
          gradientFrom="from-purple-600"
          gradientTo="to-blue-600"
          iconBgFrom="from-purple-500"
          iconBgTo="to-blue-500"
          icon={<TrophyIcon className="w-5 h-5 text-white" />}
        />
      </div>

      {/* 拼团商品完整列表 */}
      <ProductList
        title={t('home.groupBuyProducts')}
        products={groupBuyListProducts}
        isLoading={isLoadingGroupBuy}
        emptyText={t('groupBuy.noProducts')}
        linkPrefix="/group-buy"
      />

      {/* 积分商城商品完整列表 */}
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
