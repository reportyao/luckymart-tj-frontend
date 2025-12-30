import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ClipboardDocumentListIcon,
  TruckIcon,
  ShoppingBagIcon,
  TicketIcon,
  ClockIcon,
  UsersIcon,
  ArrowsRightLeftIcon,
  TrophyIcon,
  ChevronRightIcon,
  GiftIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { LazyImage } from '../components/LazyImage';
import { formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

// 订单类型
type OrderType = 'all' | 'group_buy' | 'lottery';

// 统一订单接口
interface UnifiedOrder {
  id: string;
  order_type: 'group_buy' | 'lottery' | 'exchange';
  order_number: string;
  amount: number;
  status: string;
  created_at: string;
  // 商品信息
  product_title: { zh?: string; ru?: string; tg?: string };
  product_image: string;
  original_price?: number;
  price_per_person?: number;
  // 拼团特有
  session_status?: string;
  session_code?: string;
  current_participants?: number;
  group_size?: number;
  expires_at?: string;
  session_id?: string;
  refund_lucky_coins?: number;
  // 抽奖特有
  lottery_period?: string;
  lottery_id?: string;
  shipping?: any;
  resale_listing?: any;
  // 自提信息
  pickup_code?: string;
  pickup_status?: string;
  pickup_point?: any;
  claimed_at?: string;
  picked_up_at?: string;
}

interface OrderSummary {
  group_buy_count: number;
  lottery_count: number;
  exchange_count: number;
}

const OrderManagementPageNew: React.FC = () => {
  const { supabase } = useSupabase();
  const { user, sessionToken } = useUser();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  
  const [allOrders, setAllOrders] = useState<UnifiedOrder[]>([]); // 存储所有订单
  const [summary, setSummary] = useState<OrderSummary>({ group_buy_count: 0, lottery_count: 0, exchange_count: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderType>('all');
  
  // 根据当前 Tab 筛选订单
  const orders = useMemo(() => {
    if (activeTab === 'all') return allOrders;
    return allOrders.filter(order => order.order_type === activeTab);
  }, [allOrders, activeTab]);
  const [selectedOrder, setSelectedOrder] = useState<UnifiedOrder | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);

  // 获取本地化文本
  const getLocalizedText = (text: any): string => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[i18n.language] || text.zh || text.ru || text.tg || '';
  };

  // 加载订单数据（仅加载一次）
  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!user || !sessionToken) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('get-my-orders', {
        body: {
          session_token: sessionToken,
          order_type: 'all', // 总是加载所有订单
        },
      });

      if (error) throw error;

      const result = data as { 
        success: boolean; 
        data: UnifiedOrder[]; 
        summary: OrderSummary;
        error?: string 
      };

      if (result.success) {
        setAllOrders(result.data || []);
        setSummary(result.summary || { group_buy_count: 0, lottery_count: 0, exchange_count: 0 });
      } else {
        throw new Error(result.error || 'Failed to load orders');
      }
    } catch (error) {
      console.error('Load orders error:', error);
      toast.error(t('orders.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [supabase, user, sessionToken, t]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // 获取订单类型图标
  const getOrderTypeIcon = (orderType: string) => {
    switch (orderType) {
      case 'group_buy':
        return <UsersIcon className="w-5 h-5" />;
      case 'lottery':
        return <TrophyIcon className="w-5 h-5" />;
      case 'exchange':
        return <ArrowsRightLeftIcon className="w-5 h-5" />;
      default:
        return <ShoppingBagIcon className="w-5 h-5" />;
    }
  };

  // 获取订单类型标签
  const getOrderTypeLabel = (orderType: string) => {
    switch (orderType) {
      case 'group_buy':
        return t('orders.typeGroupBuy');
      case 'lottery':
        return t('orders.typeLottery');
      case 'exchange':
        return t('orders.typeExchange');
      default:
        return t('orders.typeUnknown');
    }
  };

  // 获取状态徽章（改进版，支持自提状态）
  const getStatusBadge = (order: UnifiedOrder) => {
    // 优先判断自提状态
    if (order.pickup_status) {
      const pickupStatusMap: Record<string, { text: string; color: string }> = {
        'PENDING_CLAIM': { text: t('orders.statusCongratulations'), color: 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700' },
        'PENDING_PICKUP': { text: t('orders.statusPendingPickup'), color: 'bg-blue-100 text-blue-700' },
        'PICKED_UP': { text: t('orders.statusPickedUp'), color: 'bg-green-100 text-green-700' },
        'EXPIRED': { text: t('orders.statusExpired'), color: 'bg-red-100 text-red-700' },
      };
      
      const badge = pickupStatusMap[order.pickup_status];
      if (badge) {
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
            {badge.text}
          </span>
        );
      }
    }

    // 原有状态映射
    const statusMap: Record<string, { text: string; color: string }> = {
      // 拼团状态
      'PENDING': { text: t('orders.statusGrouping'), color: 'bg-blue-100 text-blue-700' },
      'ACTIVE': { text: t('orders.statusGrouping'), color: 'bg-blue-100 text-blue-700' },
      'WON': { text: t('orders.statusCongratulations'), color: 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700' },
      'LOST': { text: t('orders.statusFinished'), color: 'bg-gray-100 text-gray-700' },
      'REFUNDED': { text: t('orders.statusRefunded'), color: 'bg-orange-100 text-orange-700' },
      'EXPIRED': { text: t('orders.statusFinished'), color: 'bg-gray-100 text-gray-700' },
      // 抽奖状态
      'PENDING': { text: t('orders.statusWaiting'), color: 'bg-blue-100 text-blue-700' },
      'SHIPPING': { text: t('orders.statusShipping'), color: 'bg-blue-100 text-blue-700' },
      'SHIPPED': { text: t('orders.statusShipped'), color: 'bg-green-100 text-green-700' },
      'RESOLD': { text: t('orders.statusResold'), color: 'bg-purple-100 text-purple-700' },
      // 兑换状态
      'COMPLETED': { text: t('orders.statusCompleted'), color: 'bg-green-100 text-green-700' },
    };

    const badge = statusMap[order.status] || { text: order.status, color: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  // 处理订单点击
  const handleOrderClick = (order: UnifiedOrder) => {
    if (order.order_type === 'group_buy' && order.session_id) {
      if (order.status === 'WON' || order.status === 'LOST') {
        navigate(`/group-buy/result/${order.session_id}`);
      } else {
        navigate(`/group-buy/${order.session_id}`);
      }
    } else if (order.order_type === 'lottery' && order.lottery_id) {
      navigate(`/lottery/${order.lottery_id}`);
    }
  };

  // 处理确认领取
  const handleClaimPrize = (order: UnifiedOrder) => {
    setSelectedOrder(order);
    setShowClaimModal(true);
  };

  // 处理申请延期
  const handleExtendPickup = (order: UnifiedOrder) => {
    setSelectedOrder(order);
    setShowExtendModal(true);
  };

  // 处理转售
  const handleResell = (order: UnifiedOrder) => {
    navigate(`/market/create?prize_id=${order.id}`);
  };

  // Tab 配置（移除exchange）
  const tabs = [
    { key: 'all', label: t('orders.tabAll'), count: summary.group_buy_count + summary.lottery_count },
    { key: 'group_buy', label: t('orders.tabGroupBuy'), count: summary.group_buy_count },
    { key: 'lottery', label: t('orders.tabLottery'), count: summary.lottery_count },
  ];

  // 计算剩余天数
  const getRemainingDays = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 pb-20">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3 mb-4">
            <ClipboardDocumentListIcon className="w-8 h-8" />
            <h1 className="text-2xl font-bold">{t('orders.title')}</h1>
          </div>
          
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{summary.group_buy_count}</p>
              <p className="text-xs mt-1 opacity-90">{t('orders.groupBuyCount')}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{summary.lottery_count}</p>
              <p className="text-xs mt-1 opacity-90">{t('orders.lotteryCount')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b z-10">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as OrderType)}
                className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 订单列表 */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {orders.map((order, index) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white rounded-2xl shadow-sm overflow-hidden"
          >
            {/* 订单头部 */}
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getOrderTypeIcon(order.order_type)}
                <span className="text-sm font-medium text-gray-700">
                  {getOrderTypeLabel(order.order_type)}
                </span>
              </div>
              {getStatusBadge(order)}
            </div>

            {/* 订单内容 */}
            <div 
              className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => handleOrderClick(order)}
            >
              <div className="flex space-x-4">
                {/* 商品图片 */}
                {order.product_image ? (
                  <LazyImage
                    src={order.product_image}
                    alt={getLocalizedText(order.product_title)}
                    className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                    width={80}
                    height={80}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center flex-shrink-0">
                    {getOrderTypeIcon(order.order_type)}
                  </div>
                )}

                {/* 订单信息 */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 truncate mb-1">
                    {getLocalizedText(order.product_title)}
                  </h3>
                  
                  {/* 订单号 */}
                  <div className="flex items-center space-x-1 text-xs text-gray-500 mb-2">
                    <TicketIcon className="w-3 h-3" />
                    <span className="font-mono">{order.order_number}</span>
                  </div>

                  {/* 拼团特有信息 */}
                  {order.order_type === 'group_buy' && (
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      <span className="flex items-center space-x-1">
                        <UsersIcon className="w-3 h-3" />
                        <span>{order.current_participants || 0}/{order.group_size || 3}</span>
                      </span>
                      {order.refund_lucky_coins && order.refund_lucky_coins > 0 && (
                        <span className="text-purple-600">
                          +{order.refund_lucky_coins} {t('orders.pointsRefunded')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 抽奖特有信息 */}
                  {order.order_type === 'lottery' && order.lottery_period && (
                    <div className="text-xs text-gray-500">
                      {t('orders.period')}: {order.lottery_period}
                    </div>
                  )}
                </div>

                {/* 金额和箭头 */}
                <div className="flex flex-col items-end justify-between">
                  <div className="text-right">
                    <p className="text-lg font-bold text-purple-600">
                      ₽{order.amount}
                    </p>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-300" />
                </div>
              </div>
            </div>

            {/* 订单底部 - 自提信息和操作按钮 */}
            <div className="px-4 py-3 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <ClockIcon className="w-3 h-3" />
                  <span>{formatDateTime(order.created_at)}</span>
                </div>

                {/* 操作按钮 */}
                <div className="flex space-x-2">
                  {/* 待确认领取 */}
                  {order.pickup_status === 'PENDING_CLAIM' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClaimPrize(order);
                      }}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-colors flex items-center space-x-1"
                    >
                      <GiftIcon className="w-3 h-3" />
                      <span>{t('orders.claimNow')}</span>
                    </button>
                  )}

                  {/* 待提货 - 显示提货码和延期按钮 */}
                  {order.pickup_status === 'PENDING_PICKUP' && order.pickup_code && (
                    <>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center space-x-1 text-xs text-purple-600 font-bold">
                          <span>{t('orders.pickupCode')}:</span>
                          <span className="font-mono text-lg">{order.pickup_code}</span>
                        </div>
                        {order.expires_at && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {t('orders.validUntil')}: {formatDateTime(order.expires_at).split(' ')[0]}
                            {getRemainingDays(order.expires_at) <= 7 && (
                              <span className="text-red-500 ml-1">
                                ({t('orders.remainingDays', { days: getRemainingDays(order.expires_at) })})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {order.expires_at && getRemainingDays(order.expires_at) <= 7 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExtendPickup(order);
                          }}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg font-medium hover:bg-gray-200 transition-colors"
                        >
                          {t('orders.extendPickup')}
                        </button>
                      )}
                    </>
                  )}

                  {/* 已过期 - 显示延期按钮 */}
                  {order.pickup_status === 'EXPIRED' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExtendPickup(order);
                      }}
                      className="px-3 py-1.5 bg-orange-500 text-white text-xs rounded-lg font-medium hover:bg-orange-600 transition-colors"
                    >
                      {t('orders.renewPickupCode')}
                    </button>
                  )}

                  {/* 已提货 */}
                  {order.pickup_status === 'PICKED_UP' && order.picked_up_at && (
                    <div className="text-xs text-green-600">
                      {t('orders.pickedUpAt')}: {formatDateTime(order.picked_up_at).split(' ')[0]}
                    </div>
                  )}

                  {/* 转售按钮（仅待提货状态显示） */}
                  {order.pickup_status === 'PENDING_PICKUP' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResell(order);
                      }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center space-x-1"
                    >
                      <ShoppingBagIcon className="w-3 h-3" />
                      <span>{t('orders.resell')}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 自提点信息 */}
              {order.pickup_point && order.pickup_status === 'PENDING_PICKUP' && (
                <div className="mt-2 pt-2 border-t flex items-center space-x-2 text-xs text-gray-600">
                  <MapPinIcon className="w-4 h-4 text-purple-500" />
                  <div>
                    <span className="font-medium">{getLocalizedText(order.pickup_point.name_i18n)}</span>
                    <span className="mx-1">·</span>
                    <span>{getLocalizedText(order.pickup_point.address_i18n)}</span>
                    {order.pickup_point.contact_phone && (
                      <>
                        <span className="mx-1">·</span>
                        <a href={`tel:${order.pickup_point.contact_phone}`} className="text-purple-600 hover:underline">
                          {order.pickup_point.contact_phone}
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {/* 空状态 */}
        {orders.length === 0 && (
          <div className="text-center py-16">
            <ClipboardDocumentListIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">{t('orders.noOrders')}</p>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => navigate('/group-buy')}
                className="text-purple-600 font-medium hover:underline"
              >
                {t('orders.goGroupBuy')} →
              </button>
              <button
                onClick={() => navigate('/lottery')}
                className="text-purple-600 font-medium hover:underline"
              >
                {t('orders.goLottery')} →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 确认领取模态框 */}
      {showClaimModal && selectedOrder && (
        <ClaimPrizeModal
          order={selectedOrder}
          onClose={() => {
            setShowClaimModal(false);
            setSelectedOrder(null);
          }}
          onSuccess={() => {
            setShowClaimModal(false);
            setSelectedOrder(null);
            loadOrders();
          }}
        />
      )}

      {/* 延期确认模态框 */}
      {showExtendModal && selectedOrder && (
        <ExtendPickupModal
          order={selectedOrder}
          onClose={() => {
            setShowExtendModal(false);
            setSelectedOrder(null);
          }}
          onSuccess={() => {
            setShowExtendModal(false);
            setSelectedOrder(null);
            loadOrders();
          }}
        />
      )}
    </div>
  );
};

// 确认领取模态框组件
const ClaimPrizeModal: React.FC<{
  order: UnifiedOrder;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ order, onClose, onSuccess }) => {
  const { supabase } = useSupabase();
  const { sessionToken } = useUser();
  const { t, i18n } = useTranslation();
  const [pickupPoints, setPickupPoints] = useState<any[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getLocalizedText = (text: any): string => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[i18n.language] || text.zh || text.ru || text.tg || '';
  };

  useEffect(() => {
    // 加载自提点列表
    const loadPickupPoints = async () => {
      const { data, error } = await supabase
        .from('pickup_points')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: true });

      if (!error && data) {
        setPickupPoints(data);
        if (data.length > 0) {
          setSelectedPointId(data[0].id);
        }
      }
    };

    loadPickupPoints();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!sessionToken) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('claim-prize', {
        body: {
          session_token: sessionToken,
          prize_id: order.id,
          order_type: order.order_type,
          pickup_point_id: selectedPointId,
        }
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Failed to claim prize');
      }

      toast.success(t('orders.claimSuccess'));
      onSuccess();
    } catch (error: any) {
      console.error('Claim prize error:', error);
      toast.error(error.message || t('orders.claimError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg"
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
          <h3 className="text-lg font-bold">{t('orders.confirmClaim')}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-2">
              <GiftIcon className="w-6 h-6 text-purple-600" />
              <h4 className="font-bold text-gray-800">{getLocalizedText(order.product_title)}</h4>
            </div>
            <p className="text-sm text-gray-600">{t('orders.claimDescription')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orders.selectPickupPoint')} *
            </label>
            <select
              value={selectedPointId}
              onChange={(e) => setSelectedPointId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            >
              {pickupPoints.map((point) => (
                <option key={point.id} value={point.id}>
                  {getLocalizedText(point.name_i18n)} - {getLocalizedText(point.address_i18n)}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">{t('orders.claimNotice')}</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>{t('orders.claimNotice1')}</li>
              <li>{t('orders.claimNotice2')}</li>
              <li>{t('orders.claimNotice3')}</li>
            </ul>
          </div>

          <div className="pt-4 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('common.submitting') : t('common.confirm')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// 延期确认模态框组件
const ExtendPickupModal: React.FC<{
  order: UnifiedOrder;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ order, onClose, onSuccess }) => {
  const { supabase } = useSupabase();
  const { sessionToken } = useUser();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!sessionToken) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('extend-pickup', {
        body: {
          session_token: sessionToken,
          prize_id: order.id,
          order_type: order.order_type,
        }
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Failed to extend pickup');
      }

      toast.success(t('orders.extendSuccess'));
      onSuccess();
    } catch (error: any) {
      console.error('Extend pickup error:', error);
      toast.error(error.message || t('orders.extendError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg"
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
          <h3 className="text-lg font-bold">{t('orders.confirmExtend')}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-4">
            <p className="text-sm text-gray-800">
              {t('orders.extendDescription')}
            </p>
          </div>

          <div className="pt-4 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('common.submitting') : t('common.confirm')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default OrderManagementPageNew;
