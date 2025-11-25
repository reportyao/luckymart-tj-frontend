import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSupabase } from '../contexts/SupabaseContext';
import { Tables, Enums } from '../types/supabase';
import { ArrowLeftIcon, ClockIcon, UserGroupIcon, StarIcon } from '@heroicons/react/24/outline';
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
import { motion } from 'framer-motion';
import { CountdownTimer } from '../components/CountdownTimer';

type Lottery = Tables<'lotteries'>;
type Showoff = Tables<'showoffs'> & {
  user: Tables<'profiles'>;
};

const LotteryDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { supabase } = useSupabase();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<ReturnType<typeof getTimeRemaining> | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [randomShowoffs, setRandomShowoffs] = useState<Showoff[]>([]);

  const fetchLottery = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('lotteries')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setLottery(data);
      if (data.end_time) {
        setTimeRemaining(getTimeRemaining(data.end_time));
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
      // 假设存在一个 RPC 或 Edge Function 来获取随机晒单
      // 这里使用简化查询，获取最近的 3 个已审核晒单
      const { data, error } = await supabase
        .from('showoffs')
        .select(`
          *,
          user:user_id (username, avatar_url)
        `)
        .eq('status', 'APPROVED')
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;

      setRandomShowoffs(data as any);
    } catch (error) {
      console.error('Failed to fetch random showoffs:', error);
    }
  }, [supabase]);

  useEffect(() => {
    fetchLottery();
    fetchRandomShowoffs();
  }, [fetchLottery, fetchRandomShowoffs]);

  useEffect(() => {
    if (!lottery || !lottery.end_time) return;

    const timer = setInterval(() => {
      setTimeRemaining(getTimeRemaining(lottery.end_time));
    }, 1000);

    return () => clearInterval(timer);
  }, [lottery]);

  if (isLoading) {
    return <div className="text-center py-10">{t('common.loading')}...</div>;
  }

  if (!lottery) {
    return <div className="text-center py-10 text-red-500">{t('lottery.notFound')}</div>;
  }

  const title = getLocalizedText(lottery.title_i18n, i18n.language) || lottery.title;
  const description = getLocalizedText(lottery.description_i18n, i18n.language) || lottery.description;
  const specifications = getLocalizedText(lottery.specifications_i18n, i18n.language);
  const material = getLocalizedText(lottery.material_i18n, i18n.language);
  const details = getLocalizedText(lottery.details_i18n, i18n.language);

  const progress = (lottery.sold_tickets / lottery.total_tickets) * 100;
  const isActive = lottery.status === 'ACTIVE';
  const isSoldOut = lottery.status === 'SOLD_OUT';
  const isUpcoming = lottery.status === 'UPCOMING' || lottery.status === 'PENDING';

  const handlePurchase = () => {
    if (isActive) {
      // TODO: 弹出购买模态框
      toast.success(t('lottery.purchaseModalPlaceholder'));
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
          <div className="relative aspect-square">
            {lottery.image_urls && lottery.image_urls.length > 0 ? (
              <LazyImage
                src={lottery.image_urls[activeImageIndex]}
                alt={title}
                className="w-full h-full object-cover"
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
                      'w-2 h-2 rounded-full transition-colors',
                      index === activeImageIndex ? 'bg-white' : 'bg-gray-400'
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

          {/* Countdown */}
          {isActive && timeRemaining && timeRemaining.total > 0 && (
            <div className="flex items-center justify-center bg-yellow-50 p-3 rounded-lg">
              <ClockIcon className="w-5 h-5 mr-2 text-yellow-700" />
              <p className="text-sm font-medium text-yellow-700">
                {t('lottery.remainingTime')}: {timeRemaining.days > 0 && `${timeRemaining.days}天 `}
                {timeRemaining.hours.toString().padStart(2, '0')}:
                {timeRemaining.minutes.toString().padStart(2, '0')}:
                {timeRemaining.seconds.toString().padStart(2, '0')}
              </p>
            </div>
          )}

          {/* 180秒开奖倒计时 */}
          {isSoldOut && lottery.draw_time && (
            <CountdownTimer 
              drawTime={lottery.draw_time} 
              onCountdownEnd={() => {
                // 倒计时结束后刷新页面查看开奖结果
                fetchLottery();
              }}
            />
          )}

          {/* Purchase Button */}
          <div className="pt-4">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handlePurchase}
              disabled={!isActive || isSoldOut}
              className={cn(
                "w-full py-3 rounded-xl font-semibold shadow-lg transition-all duration-200",
                isActive && !isSoldOut
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-xl"
                  : "bg-gray-300 text-gray-600 cursor-not-allowed"
              )}
            >
              {isSoldOut ? t('lottery.soldOut') : isActive ? t('lottery.participateNow') : t('lottery.upcoming')}
            </motion.button>
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
                    <p className="font-semibold text-gray-800">{showoff.user?.telegram_username || '匿名用户'}</p>
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
