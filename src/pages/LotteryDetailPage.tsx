import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSupabase } from '../contexts/SupabaseContext';
import { useUser } from '../contexts/UserContext';
import { Tables, Enums } from '../types/supabase';
import { ArrowLeftIcon, ClockIcon, UserGroupIcon, StarIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { LazyImage } from '../components/LazyImage';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import {
  formatCurrency,
  formatDateTime,
  getLotteryStatusText,
  getLotteryStatusColor,
  getTimeRemaining,
  cn,
  getLocalizedText
} from '../lib/utils';
import toast from 'react-hot-toast';
import { lotteryService } from '../lib/supabase';
import { motion } from 'framer-motion';
import { CountdownTimer } from '../components/CountdownTimer';
import { useState, useEffect, useCallback } from 'react';

type Lottery = Tables<'lotteries'>;
type Showoff = Tables<'showoffs'> & {
  user: Tables<'profiles'>;
};

// 比价清单项类型
interface PriceComparisonItem {
  platform: string;
  price: number;
}

const LotteryDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { supabase } = useSupabase();
  const { user, wallets, refreshWallets } = useUser();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<ReturnType<typeof getTimeRemaining> | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [randomShowoffs, setRandomShowoffs] = useState<Showoff[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);
  const [isFullPurchasing, setIsFullPurchasing] = useState<boolean>(false);

  const fetchLottery = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      // 获取商品信息，包含关联的库存商品信息
      const { data, error } = await supabase
        .from('lotteries')
        .select(`
          *,
          inventory_product:inventory_products (
            id,
            stock,
            original_price,
            status
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      setLottery(data);
      
      // 如果已售罄或已开奖，跳转到开奖页面
      if (data && (data.status === 'SOLD_OUT' || data.status === 'COMPLETED')) {
        navigate(`/lottery/${id}/result`);
      }
    } catch (error) {
      console.error('Failed to fetch lottery:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoading(false);
    }
  }, [id, supabase, t]);

  const fetchRandomShowoffs = useCallback(async () => {
    try {
      // 获取最近的 3 个已审核晒单
      const { data: showoffsData, error: showoffsError } = await supabase
        .from('showoffs')
        .select('*')
        .eq('status', 'APPROVED')
        .order('created_at', { ascending: false })
        .limit(3);

      if (showoffsError) throw showoffsError;

      // 手动获取用户信息
      if (showoffsData && showoffsData.length > 0) {
        const userIds = showoffsData.map((s: any) => s.user_id).filter(Boolean);
        
        if (userIds.length > 0) {
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, telegram_username, avatar_url')
            .in('id', userIds);

          if (usersError) throw usersError;

          // 合并数据
          const showoffsWithUsers = showoffsData.map((showoff: any) => ({
            ...showoff,
            user: usersData?.find((u: any) => u.id === showoff.user_id) || null
          }));

          setRandomShowoffs(showoffsWithUsers);
        } else {
          // 如果没有 user_id，也需要添加 user 字段以符合类型
          const showoffsWithNullUsers = showoffsData.map((showoff: any) => ({
            ...showoff,
            user: null
          }));
          setRandomShowoffs(showoffsWithNullUsers);
        }
      } else {
        setRandomShowoffs([]);
      }
    } catch (error) {
      console.error('Failed to fetch random showoffs:', error);
      // 即使失败也不影响页面其他功能
      setRandomShowoffs([]);
    }
  }, [supabase]);

  useEffect(() => {
    fetchLottery();
    fetchRandomShowoffs();
  }, [fetchLottery, fetchRandomShowoffs]);

  // 移除活动结束时间倒计时，只保留售罄后的 180 秒开奖倒计时

  if (isLoading) {
    return <div className="text-center py-10">{t('common.loading')}...</div>;
  }

  if (!lottery) {
    return <div className="text-center py-10 text-red-500">{t('lottery.notFound')}</div>;
  }

  // 处理 title：优先使用 title_i18n，如果为空则尝试解析 title 是否为 JSON 字符串
  let title = getLocalizedText(lottery.title_i18n, i18n.language);
  if (!title) {
    title = getLocalizedText(lottery.title as any, i18n.language) || lottery.title;
  }

  // 处理 description：优先使用 description_i18n，如果为空则尝试解析 description 是否为 JSON 字符串
  let description = getLocalizedText(lottery.description_i18n, i18n.language);
  if (!description) {
    description = getLocalizedText(lottery.description as any, i18n.language) || lottery.description || '';
  }

  const specifications = getLocalizedText(lottery.specifications_i18n, i18n.language);
  const material = getLocalizedText(lottery.material_i18n, i18n.language);
  const details = getLocalizedText(lottery.details_i18n, i18n.language);

  const progress = (lottery.sold_tickets / lottery.total_tickets) * 100;
  const isActive = lottery.status === 'ACTIVE';
  const isSoldOut = lottery.status === 'SOLD_OUT';
  const isUpcoming = lottery.status === 'UPCOMING' || lottery.status === 'PENDING';

  // 获取比价清单数据
  const priceComparisons: PriceComparisonItem[] = (() => {
    try {
      const data = (lottery as any).price_comparisons;
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch {
      return [];
    }
  })();

  // 计算全款购买价格和库存
  const remainingTickets = lottery.total_tickets - lottery.sold_tickets;
  
  // 获取关联的库存商品信息
  const inventoryProduct = (lottery as any).inventory_product;
  
  // 全款购买是否启用
  const fullPurchaseEnabled = (lottery as any).full_purchase_enabled !== false;
  
  // 全款购买库存：仅使用库存商品库存，如果没有关联库存商品则显示为无限（不影响一元购物份数）
  // 重要：份数（total_tickets/sold_tickets）和库存（inventory_products.stock）是两个独立的概念
  // 份数用于一元购物抽奖，库存用于全款购买
  const fullPurchaseStock = inventoryProduct ? inventoryProduct.stock : 999999;
  
  // 全款购买价格：优先使用full_purchase_price，其次使用库存商品原价，最后使用计算价格
  const fullPurchasePrice = (lottery as any).full_purchase_price 
    || (inventoryProduct?.original_price) 
    || (lottery as any).original_price 
    || (lottery.ticket_price * lottery.total_tickets);
  
  // 全款购买是否可用
  const canFullPurchase = fullPurchaseEnabled && fullPurchaseStock > 0 && lottery.status === 'ACTIVE';

  const handlePurchase = async () => {
    // 检查登录状态
    if (!user) {
      toast.error(t('error.notLoggedIn') || t('errors.pleaseLogin'));
      return;
    }

    if (!isActive || quantity < 1) {
      toast.error(t('lottery.pleaseEnterQuantity'));
      return;
    }

    if (!lottery) {
      toast.error(t('error.unknownError'));
      return;
    }

    // 计算需要的积分数量
    const totalCost = lottery.ticket_price * quantity;
    
    // 检查积分余额
    const luckyCoinsWallet = wallets.find(w => w.type === 'LUCKY_COIN');
    const luckyCoinsBalance = luckyCoinsWallet?.balance || 0;
    
    if (luckyCoinsBalance < totalCost) {
      toast.error(t('wallet.insufficientLuckyCoins') || `t('lottery.insufficientBalance', { required: totalCost, current: luckyCoinsBalance })`);
      return;
    }

    // 检查剩余票数
    if (quantity > (lottery.total_tickets - lottery.sold_tickets)) {
      toast.error(t('lottery.sharesNotEnough'));
      return;
    }

    // 检查用户限购
    if (lottery.max_per_user && quantity > lottery.max_per_user) {
      toast.error(t('lottery.maxQuantityHint', { max: lottery.max_per_user }));
      return;
    }

    setIsPurchasing(true);
    
    try {
      // 调用购买 API，传入 user.id
      const order = await lotteryService.purchaseTickets(lottery.id, quantity, user.id);
      
      console.log('Purchase successful:', order);
      toast.success(t('lottery.purchaseSuccess'));
      
      // 刷新抽奖数据和钱包
      await fetchLottery();
      await refreshWallets();
      
      // 重置数量为 1
      setQuantity(1);
      
      // 如果售罄，跳转到开奖页面
      const { data: updatedLottery } = await supabase
        .from('lotteries')
        .select('status')
        .eq('id', id)
        .single();
      
      if (updatedLottery?.status === 'SOLD_OUT') {
        toast.success(t('lottery.soldOutRedirect'));
        navigate(`/lottery/${id}/result`);
      }
      
    } catch (error: any) {
      console.error('Purchase failed:', error);
      
      // 处理特定错误
      if (error.message?.includes(t('errors.insufficientBalance'))) {
        toast.error(t('wallet.insufficientBalance'));
      } else if (error.message?.includes(t('lottery.soldOut'))) {
        toast.error(t('lottery.soldOut'));
      } else if (error.message?.includes(t('errors.exceedsLimit'))) {
        toast.error(t('lottery.maxQuantityHint', { max: lottery.max_per_user }));
      } else {
        toast.error(error.message || t('error.purchaseFailed'));
      }
      
      // 刷新抽奖数据以获取最新状态
      await fetchLottery();
    } finally {
      setIsPurchasing(false);
    }
  };

  // 全款购买处理 - 使用原价购买，跳转到确认页
  const handleFullPurchase = async () => {
    // 检查登录状态
    if (!user) {
      toast.error(t('error.notLoggedIn') || t('errors.pleaseLogin'));
      return;
    }

    // 检查全款购买是否启用
    if (!fullPurchaseEnabled) {
      toast.error(t('lottery.fullPurchaseDisabled') || '该商品不支持全款购买');
      return;
    }

    // 检查库存（使用库存商品库存或剩余份数）
    if (fullPurchaseStock <= 0) {
      toast.error(t('lottery.fullPurchaseOutOfStock') || '库存不足，无法全款购买');
      return;
    }

    if (!isActive) {
      toast.error(t('lottery.notActive') || '商品当前不可购买');
      return;
    }

    if (!lottery) {
      toast.error(t('error.unknownError'));
      return;
    }

    // 检查积分余额
    const luckyCoinsWallet = wallets.find(w => w.type === 'LUCKY_COIN');
    const luckyCoinsBalance = luckyCoinsWallet?.balance || 0;
    
    if (luckyCoinsBalance < fullPurchasePrice) {
      toast.error(t('lottery.fullPurchaseInsufficientBalance', { 
        required: fullPurchasePrice, 
        current: luckyCoinsBalance 
      }));
      return;
    }

    // 全款购买使用原价，跳转到商品确认页选择自提点
    navigate(`/full-purchase-confirm/${lottery.id}`);
  };

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && lottery && newQuantity <= (lottery.total_tickets - lottery.sold_tickets)) {
      setQuantity(newQuantity);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>{t('common.back')}</span>
          </button>
          <h1 className="text-lg font-bold text-gray-900 truncate max-w-[70%]">{title}</h1>
          <div className="w-10"></div> {/* Placeholder for alignment */}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Image Carousel */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div 
            className="relative aspect-square overflow-hidden"
            onTouchStart={(e) => {
              const touch = e.touches[0];
              (e.currentTarget as any)._touchStartX = touch.clientX;
            }}
            onTouchEnd={(e) => {
              const touch = e.changedTouches[0];
              const startX = (e.currentTarget as any)._touchStartX;
              const diff = startX - touch.clientX;
              
              if (Math.abs(diff) > 50 && lottery.image_urls) {
                if (diff > 0 && activeImageIndex < lottery.image_urls.length - 1) {
                  setActiveImageIndex(activeImageIndex + 1);
                } else if (diff < 0 && activeImageIndex > 0) {
                  setActiveImageIndex(activeImageIndex - 1);
                }
              }
            }}
          >
            {lottery.image_urls && lottery.image_urls.length > 0 ? (
              <LazyImage
                src={lottery.image_urls[activeImageIndex]}
                alt={title}
                className="w-full h-full object-contain"
                width={600}
                height={600}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <StarIcon className="w-12 h-12 text-gray-400" />
              </div>
            )}
            {/* Image Indicators */}
            {lottery.image_urls && lottery.image_urls.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-2">
                {lottery.image_urls.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveImageIndex(index)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      index === activeImageIndex ? "bg-white" : "bg-gray-400"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lottery Info Card */}
        <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
          <div className="flex justify-between items-start">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <span className={cn(
              "px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap",
              getLotteryStatusColor(lottery.status)
            )}>
              {getLotteryStatusText(lottery.status)}
            </span>
          </div>

          <p className="text-gray-600">{description}</p>

          {/* Price Display */}
          <div className="text-center py-2">
            <p className="text-xs text-gray-500 mb-1">{t('lottery.ticketPrice')}</p>
            <p className="text-3xl font-bold text-red-500">{formatCurrency(lottery.currency, lottery.ticket_price)}</p>
          </div>

          {/* 比价清单 */}
          {priceComparisons.length > 0 && (
            <div className="bg-gray-100 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-gray-700">{t('lottery.priceComparison')}</p>
              {priceComparisons.map((item, index) => (
                <div key={index} className="flex items-center text-sm text-gray-600">
                  <XCircleIcon className="w-4 h-4 text-red-500 mr-2" />
                  <span>{item.platform}:</span>
                  <span className="ml-2 text-gray-500">{formatCurrency(lottery.currency, item.price)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Price and Tickets */}
          <div className="grid grid-cols-3 gap-4 text-center border-t pt-4">
            <div>
              <p className="text-xs text-gray-500">{t('lottery.ticketPrice')}</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(lottery.currency, lottery.ticket_price)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('lottery.totalTickets')}</p>
              <p className="text-lg font-bold text-gray-900">{lottery.total_tickets}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('lottery.maxPerUser')}</p>
              <p className="text-lg font-bold text-gray-900">{lottery.max_per_user}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center text-sm text-gray-500">
                <UserGroupIcon className="w-4 h-4 mr-1" />
                {t('lottery.soldTickets')}: {lottery.sold_tickets}/{lottery.total_tickets}
              </div>
              <span className="text-sm text-gray-500">
                {progress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {/* 移除活动结束倒计时 */}

          {/* 180秒开奖倒计时 */}
          {isSoldOut && lottery.draw_time && (
            <CountdownTimer 
              drawTime={lottery.draw_time} 
              onCountdownEnd={async () => {
                // 倒计时结束后执行开奖
                try {
                  console.log('开始开奖:', id);
                  await lotteryService.drawLottery(id!);
                  console.log('Draw successful');
                  // 刷新页面查看开奖结果
                  await fetchLottery();
                } catch (error: any) {
                  console.error('Draw failed:', error);
                  // 即使开奖失败也刷新页面，可能已经开奖了
                  await fetchLottery();
                }
              }}
            />
          )}

          {/* 购买区域 - 左右两栏布局 */}
          <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('lottery.purchaseOptions')}</h3>
            
            <div className="space-y-3">
              {/* 购买信息卡片 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 左侧：一元夺宝信息 */}
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-700 text-center">{t('lottery.luckyPurchase')}</h4>
                  
                  {/* 数量选择器 */}
                  <div className="flex items-center justify-center space-x-3">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-center text-lg font-bold"
                    >
                      -
                    </button>
                    <span className="text-xl font-bold text-gray-900 w-12 text-center">{quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      disabled={!lottery || quantity >= (lottery.total_tickets - lottery.sold_tickets)}
                      className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-center text-lg font-bold text-white"
                    >
                      +
                    </button>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-xs text-gray-500">{t('lottery.totalPrice')}</p>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(lottery?.currency || 'TJS', (lottery?.ticket_price || 0) * quantity)}
                    </p>
                  </div>

                  <p className="text-xs text-center text-gray-500 border-t border-gray-100 pt-2 mt-2">
                    {t('lottery.remainingTickets')}: {lottery ? lottery.total_tickets - lottery.sold_tickets : 0}
                  </p>
                </div>

                {/* 右侧：全款购买信息 */}
                <div className="border border-orange-200 bg-orange-50 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-medium text-orange-700 text-center">{t('lottery.fullPurchase')}</h4>
                  
                  <p className="text-xs text-center text-orange-600">{t('lottery.fullPurchaseHint')}</p>
                  
                  <div className="text-center">
                    <p className="text-xs text-gray-500">{t('lottery.fullPurchasePrice')}</p>
                    <p className="text-lg font-bold text-orange-600">
                      {formatCurrency(lottery?.currency || 'TJS', fullPurchasePrice)}
                    </p>
                  </div>

                </div>
              </div>
              
              {/* 底部按钮 - 水平对齐 */}
              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handlePurchase}
                  disabled={!isActive || isSoldOut || isPurchasing}
                  className={cn(
                    "py-3 rounded-xl font-semibold text-sm shadow-md transition-all duration-200",
                    isActive && !isSoldOut && !isPurchasing
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed"
                  )}
                >
                  {isPurchasing ? t('common.submitting') : isSoldOut ? t('lottery.soldOut') : isActive ? t('lottery.participateNow') : t('lottery.upcoming')}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleFullPurchase}
                  disabled={!canFullPurchase || isSoldOut || isFullPurchasing}
                  className={cn(
                    "py-3 rounded-xl font-semibold text-sm shadow-md transition-all duration-200",
                    canFullPurchase && !isSoldOut && !isFullPurchasing
                      ? "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-lg"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed"
                  )}
                >
                  {isFullPurchasing ? t('common.submitting') : !fullPurchaseEnabled ? t('lottery.fullPurchaseDisabled') : fullPurchaseStock <= 0 ? t('lottery.fullPurchaseOutOfStock') : t('lottery.buyAllNow')}
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details */}
        <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
          <h3 className="text-xl font-bold text-gray-900 border-b pb-2">{t('lottery.productDetails')}</h3>

          {/* Specifications and Material */}
          {(specifications || material) && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {specifications && (
                <div>
                  <p className="font-semibold text-gray-700">{t('lottery.specifications')}</p>
                  <p className="text-gray-600 whitespace-pre-wrap">{specifications}</p>
                </div>
              )}
              {material && (
                <div>
                  <p className="font-semibold text-gray-700">{t('lottery.material')}</p>
                  <p className="text-gray-600 whitespace-pre-wrap">{material}</p>
                </div>
              )}
            </div>
          )}

          {/* Rich Text Details */}
          {details && (
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: details }} />
          )}
        </div>

        {/* Random Showoffs Section */}
        <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
          <h3 className="text-xl font-bold text-gray-900 border-b pb-2">{t('showoff.recentShowoffs')}</h3>
          {randomShowoffs.length > 0 ? (
            <div className="space-y-4">
              {randomShowoffs.map((showoff, index) => (
                <div key={showoff.id} className="border-b last:border-b-0 pb-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                      {showoff.user?.telegram_username ? showoff.user.telegram_username[0] : 'U'}
                    </div>
                    <p className="font-semibold text-gray-800">{showoff.user?.telegram_username || t('errors.anonymousUser')}</p>
                  </div>
                  <p className="text-sm text-gray-700 mb-2 line-clamp-3">{showoff.content}</p>
                  {showoff.images && showoff.images.length > 0 && (
                    <div className="flex space-x-2 overflow-x-auto">
                      {showoff.images.slice(0, 3).map((url, imgIndex) => (
                        <LazyImage
                          key={imgIndex}
                          src={url}
                          alt={`Showoff Image ${imgIndex + 1}`}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                          width={80}
                          height={80}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">{formatDateTime(showoff.created_at)}</p>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => navigate('/showoff')}>
                {t('showoff.viewAll')}
              </Button>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              {t('showoff.noShowoffsYet')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LotteryDetailPage;
