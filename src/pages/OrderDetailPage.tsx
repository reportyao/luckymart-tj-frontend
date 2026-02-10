import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabase } from '../contexts/SupabaseContext';
import { useUser } from '../contexts/UserContext';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ShoppingBagIcon,
  MapPinIcon,
  ClockIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  PhoneIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  TicketIcon,
  TruckIcon,
  GiftIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { LazyImage } from '../components/LazyImage';
import { LogisticsStatus } from '../components/LogisticsStatus';
import { formatDateTime, formatCurrency, copyToClipboard } from '../lib/utils';
import toast from 'react-hot-toast';
import { extractEdgeFunctionError } from '../utils/edgeFunctionHelper'

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  currency: string;
  pickup_code: string | null;
  pickup_status?: string;
  logistics_status?: string | null;
  batch_id?: string | null;
  claimed_at: string | null;
  created_at: string;
  metadata: any;
  lottery_id: string;
  shipment_batch?: {
    china_tracking_no: string | null;
    tajikistan_tracking_no: string | null;
    estimated_arrival_date: string | null;
  } | null;
  lotteries: {
    title: string;
    title_i18n: any;
    image_url: string;
    image_urls?: string[];
    original_price: number;
  } | null;
  pickup_point: {
    name: string;
    name_i18n: any;
    address: string;
    address_i18n: any;
    contact_phone: string;
    is_active: boolean;
  } | null;
  available_pickup_points?: Array<{
    id: string;
    name: string;
    name_i18n: any;
    address: string;
    address_i18n: any;
    contact_phone: string;
  }>;
}

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { supabase } = useSupabase();
  const { user } = useUser();
  const { t, i18n } = useTranslation();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPickupPointId, setSelectedPickupPointId] = useState<string>('');
  const [isUpdatingPickupPoint, setIsUpdatingPickupPoint] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    fetchOrderDetail();
  }, [user, id]);

  const fetchOrderDetail = async () => {
    try {
      setLoading(true);
      
      // 使用 Edge Function 获取订单详情，绕过 RLS 限制
      const { data, error } = await supabase.functions.invoke('get-order-detail', {
        body: {
          order_id: id,
          user_id: user?.id
        }
      });

      if (error) throw new Error(await extractEdgeFunctionError(error));
      if (!data) throw new Error('Order not found');

      setOrder(data);
    } catch (error) {
      console.error('Error fetching order detail:', error);
      toast.error(t('orders.loadError') || '加载订单失败');
    } finally {
      setLoading(false);
    }
  };

  const getLocalizedText = (text: any): string => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[i18n.language] || text.zh || text.ru || text.tg || '';
  };

  // 根据订单元数据获取订单类型标签
  const getOrderTypeLabel = (orderData: OrderDetail): string => {
    const metaType = orderData.metadata?.type;
    switch (metaType) {
      case 'prize':
      case 'lottery':
        return t('order.oneYuanShopping') || '一元购物';
      case 'full_purchase':
        return t('order.fullPurchase') || '全款购物';
      case 'group_buy':
        return t('order.normalGroupBuy') || '普通拼团';
      case 'auto_group_buy':
      case 'squad':
        return t('order.autoGroupBuy') || '一键包团';
      default:
        return t('order.fullPurchase') || '全款购物';
    }
  };

  const copyPickupCode = async () => {
    if (order?.pickup_code) {
      const success = await copyToClipboard(order.pickup_code);
      if (success) {
        toast.success(t('lottery.winningCodeCopied') || '提货码已复制');
      } else {
        toast.error(t('common.copyFailed') || '复制失败');
      }
    }
  };

  const copyOrderNumber = async () => {
    if (order?.order_number) {
      const success = await copyToClipboard(order.order_number);
      if (success) {
        toast.success(t('order.orderNumberCopied') || '订单号已复制');
      } else {
        toast.error(t('common.copyFailed') || '复制失败');
      }
    }
  };

  // 更新自提点
  const handleUpdatePickupPoint = async () => {
    if (!selectedPickupPointId || !order) {
      toast.error(t('orders.pleaseSelectPickupPoint') || '请选择自提点');
      return;
    }

    setIsUpdatingPickupPoint(true);
    try {
      // 使用 Edge Function 更新自提点，避免类型问题
      const { data, error } = await supabase.functions.invoke('update-pickup-point', {
        body: {
          order_id: order.id,
          order_type: order.metadata?.type || 'prize',
          pickup_point_id: selectedPickupPointId,
          user_id: user?.id
        }
      });

      if (error) throw new Error(await extractEdgeFunctionError(error));
      if (!data?.success) throw new Error(data?.error || 'Update failed');

      toast.success(t('orders.pickupPointUpdated') || '自提点更新成功');
      
      // 重新加载订单详情
      await fetchOrderDetail();
    } catch (error: any) {
      console.error('Error updating pickup point:', error);
      toast.error(t('orders.updatePickupPointError') || '更新自提点失败');
    } finally {
      setIsUpdatingPickupPoint(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { text: string; color: string; bgColor: string; icon: React.ReactNode }> = {
      'PENDING': { 
        text: t('orders.statusPending') || '待处理', 
        color: 'text-yellow-700', 
        bgColor: 'bg-yellow-100',
        icon: <ClockIcon className="w-5 h-5" />
      },
      'COMPLETED': { 
        text: t('orders.statusCompleted') || '已完成', 
        color: 'text-green-700', 
        bgColor: 'bg-green-100',
        icon: <CheckCircleSolidIcon className="w-5 h-5" />
      },
      'PENDING_PICKUP': { 
        text: t('orders.statusPendingPickup') || '待提货', 
        color: 'text-blue-700', 
        bgColor: 'bg-blue-100',
        icon: <TruckIcon className="w-5 h-5" />
      },
      'PENDING_CLAIM': { 
        text: t('orders.statusPendingClaim') || '待领取', 
        color: 'text-orange-700', 
        bgColor: 'bg-orange-100',
        icon: <GiftIcon className="w-5 h-5" />
      },
      'PICKED_UP': { 
        text: t('orders.statusPickedUp') || '已提货', 
        color: 'text-green-700', 
        bgColor: 'bg-green-100',
        icon: <CheckCircleSolidIcon className="w-5 h-5" />
      },
      'EXPIRED': { 
        text: t('orders.statusExpired') || '已过期', 
        color: 'text-red-700', 
        bgColor: 'bg-red-100',
        icon: <ClockIcon className="w-5 h-5" />
      },
      // 物流状态
      'PENDING_SHIPMENT': { 
        text: t('logistics.pendingShipment') || '待发货', 
        color: 'text-gray-700', 
        bgColor: 'bg-gray-100',
        icon: <ClockIcon className="w-5 h-5" />
      },
      'IN_TRANSIT_CHINA': { 
        text: t('logistics.inTransitChina') || '中国段运输中', 
        color: 'text-blue-700', 
        bgColor: 'bg-blue-100',
        icon: <TruckIcon className="w-5 h-5" />
      },
      'IN_TRANSIT_TAJIKISTAN': { 
        text: t('logistics.inTransitTajikistan') || '塔吉克斯坦段运输中', 
        color: 'text-purple-700', 
        bgColor: 'bg-purple-100',
        icon: <TruckIcon className="w-5 h-5" />
      },
      'READY_FOR_PICKUP': { 
        text: t('logistics.readyForPickup') || '已到达，待提货', 
        color: 'text-green-700', 
        bgColor: 'bg-green-100',
        icon: <MapPinIcon className="w-5 h-5" />
      },
    };

    return statusMap[status] || { 
      text: status, 
      color: 'text-gray-700', 
      bgColor: 'bg-gray-100',
      icon: <ShoppingBagIcon className="w-5 h-5" />
    };
  };

  // 计算有效期（创建后30天）
  const getExpiryDate = () => {
    if (!order?.created_at) return null;
    const createdDate = new Date(order.created_at);
    const expiryDate = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiryDate;
  };

  // 检查是否已过期
  const isExpired = () => {
    const expiryDate = getExpiryDate();
    if (!expiryDate) return false;
    return new Date() > expiryDate;
  };

  // 获取剩余天数
  const getRemainingDays = () => {
    const expiryDate = getExpiryDate();
    if (!expiryDate) return 0;
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
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
        <GiftIcon className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-gray-600 mb-4">{t('orders.noOrders') || '未找到订单'}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          {t('common.back') || '返回'}
        </button>
      </div>
    );
  }

  // 优先显示物流状态，其次是提货状态
  const displayStatus = order.logistics_status || order.pickup_status || order.status;
  const statusInfo = getStatusInfo(displayStatus);
  const productTitle = getLocalizedText(order.lotteries?.title_i18n) || order.metadata?.product_title || t('order.unknownProduct') || '未知商品';
  const productImage = order.lotteries?.image_url || order.metadata?.product_image;
  const remainingDays = getRemainingDays();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 pb-20">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-white/20 rounded-lg transition"
              >
                <ArrowLeftIcon className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold">{t('order.orderDetails') || '订单详情'}</h1>
            </div>
            <button
              onClick={fetchOrderDetail}
              disabled={loading}
              className="p-2 hover:bg-white/20 rounded-lg transition disabled:opacity-50"
              title={t('common.refresh') || '刷新'}
            >
              <ArrowPathIcon className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* 订单状态卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-5 shadow-sm ${statusInfo.bgColor}`}
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full bg-white/50 ${statusInfo.color}`}>
              {statusInfo.icon}
            </div>
            <div className="flex-1">
              <h2 className={`text-lg font-bold ${statusInfo.color}`}>{statusInfo.text}</h2>
              {/* 显示物流状态描述 */}
              {order.logistics_status && (
                <p className="text-sm text-gray-600 mt-1">
                  {order.logistics_status === 'PENDING_SHIPMENT' && (t('logistics.pendingShipmentDesc') || '您的订单正在等待发货，请耐心等待。')}
                  {order.logistics_status === 'IN_TRANSIT_CHINA' && (t('logistics.inTransitChinaDesc') || '您的包裹正在中国境内运输，即将发往塔吉克斯坦。')}
                  {order.logistics_status === 'IN_TRANSIT_TAJIKISTAN' && (t('logistics.inTransitTajikistanDesc') || '您的包裹已到达塔吉克斯坦，正在派送至自提点。')}
                  {order.logistics_status === 'READY_FOR_PICKUP' && (t('logistics.readyForPickupDesc') || '您的包裹已到达自提点，请携带提货码前往提货。')}
                  {order.logistics_status === 'PICKED_UP' && (t('logistics.pickedUpDesc') || '您已成功提货，感谢您的购买！')}
                </p>
              )}
              {/* 显示剩余提货天数 */}
              {order.logistics_status === 'READY_FOR_PICKUP' && !isExpired() && remainingDays > 0 && (
                <p className="text-sm text-orange-600 mt-1 font-medium">
                  {t('order.remainingDays', { days: remainingDays }) || `剩余 ${remainingDays} 天提货`}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* 商品信息卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center space-x-2 mb-4">
            <ShoppingBagIcon className="w-5 h-5 text-purple-600" />
            <h2 className="text-base font-bold text-gray-900">{t('order.productInfo') || '商品信息'}</h2>
          </div>
          
          {/* 商品标题（多语言支持） */}
          <h3 className="font-semibold text-gray-900 mb-3 text-lg">{productTitle}</h3>
          
          {/* 多图轮播 */}
          {order.lotteries?.image_urls && order.lotteries.image_urls.length > 0 ? (
            <div className="mb-4">
              <div className="grid grid-cols-3 gap-2">
                {order.lotteries.image_urls.slice(0, 3).map((url, index) => (
                  <LazyImage
                    key={index}
                    src={url}
                    alt={`${productTitle} - ${index + 1}`}
                    className="w-full h-24 rounded-lg object-cover"
                  />
                ))}
              </div>
            </div>
          ) : productImage ? (
            <div className="mb-4">
              <LazyImage
                src={productImage}
                alt={productTitle}
                className="w-full h-48 rounded-lg object-cover"
              />
            </div>
          ) : null}
          
          {/* 支付金额 */}
          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
            <span className="text-sm text-gray-600">{t('order.paymentAmount') || '支付金额'}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm text-gray-500">{order.currency}</span>
              <span className="text-xl font-bold text-purple-600">
                {order.total_amount}
              </span>
            </div>
          </div>
        </motion.div>

        {/* 物流状态卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <LogisticsStatus
            status={order.logistics_status || 'PENDING_SHIPMENT'}
            chinaTrackingNo={order.shipment_batch?.china_tracking_no}
            tajikistanTrackingNo={order.shipment_batch?.tajikistan_tracking_no}
            estimatedArrivalDate={order.shipment_batch?.estimated_arrival_date}
            pickupCode={order.pickup_code}
          />
        </motion.div>

        {/* 提货码卡片 */}
        {order.pickup_code && order.logistics_status === 'READY_FOR_PICKUP' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-5 shadow-lg text-white"
          >
            <div className="flex items-center space-x-2 mb-4">
              <TicketIcon className="w-5 h-5" />
              <h2 className="text-base font-bold">{t('orders.pickupCode') || '提货码'}</h2>
            </div>

            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black tracking-[0.3em]">
                  {order.pickup_code}
                </span>
                <button
                  onClick={copyPickupCode}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                  title={t('common.copy') || '复制'}
                >
                  <DocumentDuplicateIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-sm opacity-90">
              <ClockIcon className="w-4 h-4" />
              <span>
                {t('orders.validUntil') || '有效期至'}: {formatDateTime(getExpiryDate()?.toISOString() || '')}
              </span>
            </div>
          </motion.div>
        )}

        {/* 自提点信息卡片 */}
        {order.pickup_point && order.pickup_point.is_active && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-5 shadow-sm"
          >
            <div className="flex items-center space-x-2 mb-4">
              <MapPinIcon className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-gray-900">{t('orders.pickupPointInfo') || '自提点信息'}</h2>
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <MapPinIcon className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('orders.pickupPointName') || '自提点名称'}</p>
                  <p className="font-medium text-gray-900">
                    {getLocalizedText(order.pickup_point.name_i18n) || order.pickup_point.name}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <TruckIcon className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('orders.pickupPointAddress') || '地址'}</p>
                  <p className="font-medium text-gray-900">
                    {getLocalizedText(order.pickup_point.address_i18n) || order.pickup_point.address}
                  </p>
                </div>
              </div>

              {order.pickup_point.contact_phone && (
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <PhoneIcon className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('orders.pickupPointPhone') || '联系电话'}</p>
                    <a 
                      href={`tel:${order.pickup_point.contact_phone}`}
                      className="font-medium text-purple-600 hover:underline"
                    >
                      {order.pickup_point.contact_phone}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* 自提点选择器 - 当原自提点被禁用或未设置时显示 */}
        {(!order.pickup_point || !order.pickup_point.is_active) && order.available_pickup_points && order.available_pickup_points.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-5 shadow-sm border-2 border-purple-200"
          >
            <div className="flex items-center space-x-2 mb-4">
              <MapPinIcon className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-gray-900">{t('orders.selectPickupPoint') || '选择自提点'}</h2>
            </div>


            <div className="space-y-3">
              <select
                value={selectedPickupPointId}
                onChange={(e) => setSelectedPickupPointId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">{t('orders.pleaseSelect') || '请选择自提点'}</option>
                {order.available_pickup_points.map((point) => (
                  <option key={point.id} value={point.id}>
                    {getLocalizedText(point.name_i18n) || point.name} - {getLocalizedText(point.address_i18n) || point.address}
                  </option>
                ))}
              </select>

              <button
                onClick={handleUpdatePickupPoint}
                disabled={!selectedPickupPointId || isUpdatingPickupPoint}
                className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 focus:ring-4 focus:ring-purple-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isUpdatingPickupPoint ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    {t('orders.updating') || '更新中...'}
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    {t('orders.confirmSelection') || '确认选择'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* 订单信息卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center space-x-2 mb-4">
            <CalendarIcon className="w-5 h-5 text-purple-600" />
            <h2 className="text-base font-bold text-gray-900">{t('order.orderInfo') || '订单信息'}</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">{t('order.orderNumber') || '订单号'}</span>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900 text-sm">{order.order_number}</span>
                <button
                  onClick={copyOrderNumber}
                  className="p-1 hover:bg-gray-100 rounded transition"
                  title={t('common.copy') || '复制'}
                >
                  <DocumentDuplicateIcon className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">{t('order.orderType') || '订单类型'}</span>
              <span className="font-medium text-gray-900 text-sm">{getOrderTypeLabel(order)}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">{t('order.orderTime') || '下单时间'}</span>
              <span className="font-medium text-gray-900 text-sm">{formatDateTime(order.created_at)}</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-500">{t('order.paymentAmount') || '支付金额'}</span>
              <span className="font-bold text-purple-600">{formatCurrency(order.currency, order.total_amount)}</span>
            </div>
          </div>
        </motion.div>

        {/* 温馨提示 */}
        {order.pickup_status === 'PENDING_PICKUP' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl p-4"
          >
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <GiftIcon className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h3 className="font-medium text-amber-800 mb-1">{t('order.pickupTips') || '温馨提示'}</h3>
                <p className="text-sm text-amber-700">
                  {t('order.pickupTipsContent') || '请在有效期内前往自提点提货，出示提货码即可领取商品。'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default OrderDetailPage;
