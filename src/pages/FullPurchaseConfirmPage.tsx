import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSupabase } from '../contexts/SupabaseContext';
import { useUser } from '../contexts/UserContext';
import { Tables } from '../types/supabase';
import { ArrowLeftIcon, MapPinIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { LazyImage } from '../components/LazyImage';
import { Button } from '../components/ui/button';
import { formatCurrency, getLocalizedText, cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

type Lottery = Tables<'lotteries'>;
type PickupPoint = Tables<'pickup_points'>;

const FullPurchaseConfirmPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { supabase } = useSupabase();
  const { user, wallets, refreshWallets } = useUser();
  const { lotteryId } = useParams<{ lotteryId: string }>();
  const navigate = useNavigate();

  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLottery = useCallback(async () => {
    if (!lotteryId) return;
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
        .eq('id', lotteryId)
        .single();

      if (error) throw error;
      setLottery(data);
    } catch (error) {
      console.error('Failed to fetch lottery:', error);
      toast.error(t('error.networkError'));
    }
  }, [lotteryId, supabase, t]);

  const fetchPickupPoints = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pickup_points')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        setPickupPoints(data);
        setSelectedPointId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch pickup points:', error);
      toast.error(t('error.networkError'));
    }
  }, [supabase, t]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchLottery(), fetchPickupPoints()]).finally(() => {
      setIsLoading(false);
    });
  }, [fetchLottery, fetchPickupPoints]);

  const handleConfirm = async () => {
    if (!user || !lottery || !selectedPointId) {
      toast.error(t('error.unknownError'));
      return;
    }

    setIsSubmitting(true);
    try {
      // 获取 session token
      const sessionToken = localStorage.getItem('custom_session_token');
      if (!sessionToken) {
        throw new Error(t('common.pleaseLogin'));
      }

      // 调用后端API创建全款购买订单
      const { data, error } = await supabase.functions.invoke('create-full-purchase-order', {
        body: {
          lottery_id: lotteryId,
          pickup_point_id: selectedPointId,
          user_id: user.id,
          session_token: sessionToken,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(t('lottery.fullPurchaseSuccess'));
        await refreshWallets();
        // 跳转到订单管理页面
        navigate('/orders');
      } else {
        throw new Error(data?.error || t('error.unknownError'));
      }
    } catch (error: any) {
      console.error('Create full purchase order failed:', error);
      toast.error(error.message || t('error.purchaseFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLocalizedPickupPointName = (point: PickupPoint) => {
    if (point.name_i18n) {
      return getLocalizedText(point.name_i18n, i18n.language) || point.name;
    }
    return point.name;
  };

  const getLocalizedPickupPointAddress = (point: PickupPoint) => {
    if (point.address_i18n) {
      return getLocalizedText(point.address_i18n, i18n.language) || point.address;
    }
    return point.address;
  };

  if (isLoading) {
    return <div className="text-center py-10">{t('common.loading')}...</div>;
  }

  if (!lottery) {
    return <div className="text-center py-10 text-red-500">{t('lottery.notFound')}</div>;
  }

  const title = getLocalizedText(lottery.title_i18n, i18n.language) || lottery.title;

  // 获取关联的库存商品信息
  const inventoryProduct = (lottery as any).inventory_product;
  
  // 全款购买价格：优先使用full_purchase_price，其次使用库存商品原价，最后使用计算价格
  const fullPurchasePrice = (lottery as any).full_purchase_price 
    || (inventoryProduct?.original_price) 
    || (lottery as any).original_price 
    || (lottery.ticket_price * lottery.total_tickets);
  
  // 全款购买库存
  const fullPurchaseStock = inventoryProduct ? inventoryProduct.stock : (lottery.total_tickets - lottery.sold_tickets);

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
          <h1 className="text-lg font-bold text-gray-900 truncate max-w-[70%]">
            {t('lottery.confirmOrder')}
          </h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Product Info */}
        <div className="bg-white rounded-xl shadow-md p-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">{t('lottery.productInfo')}</h3>
          
          <div className="flex gap-4">
            {lottery.image_urls && lottery.image_urls.length > 0 && (
              <LazyImage
                src={lottery.image_urls[0]}
                alt={title}
                className="w-24 h-24 object-cover rounded-lg"
                width={96}
                height={96}
              />
            )}
            
            <div className="flex-1">
              <p className="font-bold text-gray-900">{title}</p>
              <p className="text-sm text-gray-600 mt-2">
                {t('lottery.fullPurchasePrice')}: <span className="font-bold text-red-500">
                  {formatCurrency(lottery.currency, fullPurchasePrice)}
                </span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {t('lottery.quantity')}: <span className="font-bold">1</span>
              </p>
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-medium">{t('lottery.totalAmount')}</span>
              <span className="text-2xl font-bold text-red-500">
                {formatCurrency(lottery.currency, fullPurchasePrice)}
              </span>
            </div>
          </div>
        </div>

        {/* Pickup Point Selection */}
        <div className="bg-white rounded-xl shadow-md p-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MapPinIcon className="w-5 h-5 text-blue-500" />
            {t('orders.selectPickupPoint')}
          </h3>

          {pickupPoints.length > 0 ? (
            <div className="space-y-2">
              {pickupPoints.map((point) => (
                <motion.button
                  key={point.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedPointId(point.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border-2 transition-all duration-200",
                    selectedPointId === point.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {getLocalizedPickupPointName(point)}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {getLocalizedPickupPointAddress(point)}
                      </p>
                      {point.contact_phone && (
                        <p className="text-sm text-gray-500 mt-1">
                          {t('orders.phone')}: {point.contact_phone}
                        </p>
                      )}
                    </div>
                    {selectedPointId === point.id && (
                      <CheckCircleIcon className="w-6 h-6 text-blue-500 flex-shrink-0 ml-2" />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {t('orders.noPickupPoints')}
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-xl shadow-md p-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">{t('lottery.orderSummary')}</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('lottery.productPrice')}</span>
              <span className="text-gray-900 font-medium">
                {formatCurrency(lottery.currency, (lottery as any).original_price || (lottery.ticket_price * lottery.total_tickets))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('lottery.quantity')}</span>
              <span className="text-gray-900 font-medium">1</span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="text-gray-900 font-semibold">{t('lottery.totalAmount')}</span>
              <span className="text-lg font-bold text-red-500">
                {formatCurrency(lottery.currency, (lottery as any).original_price || (lottery.ticket_price * lottery.total_tickets))}
              </span>
            </div>
          </div>
        </div>

        {/* Confirm Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleConfirm}
          disabled={isSubmitting || !selectedPointId}
          className={cn(
            "w-full py-3 rounded-xl font-semibold text-white shadow-md transition-all duration-200 sticky bottom-4",
            !isSubmitting && selectedPointId
              ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg"
              : "bg-gray-300 cursor-not-allowed"
          )}
        >
          {isSubmitting ? t('common.submitting') : t('lottery.confirmOrder')}
        </motion.button>
      </div>
    </div>
  );
};

export default FullPurchaseConfirmPage;
