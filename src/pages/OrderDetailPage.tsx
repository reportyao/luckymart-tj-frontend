import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabase } from '../contexts/SupabaseContext';
import { useUser } from '../contexts/UserContext';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  ShoppingBagIcon,
  MapPinIcon,
  ClockIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { LazyImage } from '../components/LazyImage';
import { formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  currency: string;
  pickup_code: string | null;
  pickup_status?: string;
  claimed_at: string | null;
  created_at: string;
  metadata: any;
  lottery_id: string;
  lotteries: {
    title: string;
    title_i18n: any;
    image_url: string;
    original_price: number;
  };
  pickup_point: {
    name: string;
    name_i18n: any;
    address: string;
    address_i18n: any;
    contact_phone: string;
  } | null;
}

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { supabase } = useSupabase();
  const { user } = useUser();
  const { t, i18n } = useTranslation();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    fetchOrderDetail();
  }, [user, id]);

  const fetchOrderDetail = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await (supabase as any)
        .from('full_purchase_orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          currency,
          pickup_code,
          claimed_at,
          created_at,
          metadata,
          lottery_id,
          pickup_point_id,
          lotteries (
            title,
            title_i18n,
            image_url,
            original_price
          )
        `)
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      // 如果有 pickup_point_id，获取自提点信息
      let pickupPoint = null;
      if (data.pickup_point_id) {
        const { data: pointData } = await supabase
          .from('pickup_points')
          .select('name, name_i18n, address, address_i18n, contact_phone')
          .eq('id', data.pickup_point_id)
          .single();
        pickupPoint = pointData;
      }

      // 计算 pickup_status
      const pickup_status = data.pickup_code ? (data.claimed_at ? 'PICKED_UP' : 'PENDING_PICKUP') : data.status;
      setOrder({ ...data, pickup_status, pickup_point: pickupPoint });
    } catch (error) {
      console.error('Error fetching order detail:', error);
      toast.error(t('orders.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const getLocalizedText = (text: any): string => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[i18n.language] || text.zh || text.ru || text.tg || '';
  };

  const copyPickupCode = () => {
    if (order?.pickup_code) {
      navigator.clipboard.writeText(order.pickup_code);
      toast.success(t('lottery.winningCodeCopied'));
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      'PENDING_PICKUP': { text: t('orders.statusPendingPickup'), color: 'bg-blue-100 text-blue-700' },
      'PICKED_UP': { text: t('orders.statusPickedUp'), color: 'bg-green-100 text-green-700' },
      'EXPIRED': { text: t('orders.statusExpired'), color: 'bg-red-100 text-red-700' },
    };

    const badge = statusMap[status] || { text: status, color: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex flex-col items-center justify-center px-4">
        <p className="text-gray-600 mb-4">{t('orders.noOrders')}</p>
        <button
          onClick={() => navigate('/orders-management')}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          {t('common.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 pb-20">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/orders-management')}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <ArrowLeftIcon className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold">{t('order.orderDetails')}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 订单状态卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <ShoppingBagIcon className="w-6 h-6 text-purple-600" />
              <span className="font-medium text-gray-900">{t('order.fullPurchase')}</span>
            </div>
            {getStatusBadge(order.pickup_status || order.status)}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('order.orderNumber')}:</span>
              <span className="font-medium">{order.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('order.orderTime')}:</span>
              <span className="font-medium">{formatDateTime(order.created_at)}</span>
            </div>
          </div>
        </motion.div>

        {/* 商品信息 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-sm"
        >
          <h2 className="text-lg font-bold mb-4">{t('order.product')}</h2>
          <div className="flex space-x-4">
            <LazyImage
              src={order.lotteries?.image_url || order.metadata?.product_image}
              alt={getLocalizedText(order.lotteries?.title_i18n) || order.metadata?.product_title}
              className="w-24 h-24 rounded-xl object-cover"
            />
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 mb-2">
                {getLocalizedText(order.lotteries?.title_i18n) || order.metadata?.product_title}
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('lottery.totalAmount')}:</span>
                <span className="text-lg font-bold text-purple-600">
                  {order.total_amount} {order.currency}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 提货码信息 */}
        {order.pickup_code && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 shadow-sm border-2 border-purple-200"
          >
            <div className="flex items-center space-x-2 mb-4">
              <CheckCircleIcon className="w-6 h-6 text-purple-600" />
              <h2 className="text-lg font-bold">{t('orders.pickupCode')}</h2>
            </div>

            <div className="bg-white rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-purple-600 tracking-wider">
                  {order.pickup_code}
                </span>
                <button
                  onClick={copyPickupCode}
                  className="p-2 hover:bg-purple-100 rounded-lg transition"
                >
                  <DocumentDuplicateIcon className="w-6 h-6 text-purple-600" />
                </button>
              </div>
            </div>

            {order.created_at && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <ClockIcon className="w-4 h-4" />
                <span>{t('orders.validUntil')}: {formatDateTime(new Date(new Date(order.created_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString())}</span>
              </div>
            )}
          </motion.div>
        )}

        {/* 自提点信息 */}
        {order.pickup_point && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center space-x-2 mb-4">
              <MapPinIcon className="w-6 h-6 text-purple-600" />
              <h2 className="text-lg font-bold">{t('orders.selectPickupPoint')}</h2>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">{t('common.name')}:</span>
                <span className="ml-2 font-medium">
                  {getLocalizedText(order.pickup_point.name_i18n) || order.pickup_point.name}
                </span>
              </div>
              <div>
                <span className="text-gray-600">{t('orders.pickupPointAddress')}:</span>
                <span className="ml-2 font-medium">
                  {getLocalizedText(order.pickup_point.address_i18n) || order.pickup_point.address}
                </span>
              </div>
              <div>
                <span className="text-gray-600">{t('orders.pickupPointPhone')}:</span>
                <span className="ml-2 font-medium">{order.pickup_point.contact_phone}</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default OrderDetailPage;
