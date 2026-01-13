import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSupabase } from '../contexts/SupabaseContext';
import { useUser } from '../contexts/UserContext';
import { ArrowLeftIcon, CubeIcon, TruckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { formatCurrency, formatDateTime, getLocalizedText } from '../lib/utils';
import { motion } from 'framer-motion';

interface PendingPickupItem {
  id: string;
  type: 'lottery' | 'groupbuy' | 'full_purchase' | 'prize'; // 类型：积分商城抽奖、拼团、全款购买、中奖
  productId: string;
  productTitle: string;
  productImage: string;
  price: number;
  currency: string;
  quantity: number;
  participationCode?: string; // 参与码（积分商城）
  sessionCode?: string; // 会话码（拼团）
  pickupCode?: string; // 提货码
  createdAt: string;
  status: string; // 物流状态
  logisticsStatus?: string; // 物流状态
  orderDetailLink?: string; // 进入详情页的链接
}

// 物流状态映射
const getLogisticsStatusText = (status: string | undefined, t: any): string => {
  switch (status) {
    case 'PENDING_SHIPMENT':
      return t('logistics.pendingShipment') || '待发货';
    case 'IN_TRANSIT_CHINA':
      return t('logistics.inTransitChina') || '中国段运输中';
    case 'IN_TRANSIT_TAJIKISTAN':
      return t('logistics.inTransitTajikistan') || '塔吉克斯坦段运输中';
    case 'READY_FOR_PICKUP':
      return t('logistics.readyForPickup') || '已到达，待提货';
    case 'PICKED_UP':
      return t('logistics.pickedUp') || '已提货';
    default:
      return t('logistics.pendingShipment') || '待发货';
  }
};

// 物流状态颜色
const getLogisticsStatusColor = (status: string | undefined): string => {
  switch (status) {
    case 'PENDING_SHIPMENT':
      return 'bg-gray-100 text-gray-600';
    case 'IN_TRANSIT_CHINA':
      return 'bg-blue-100 text-blue-600';
    case 'IN_TRANSIT_TAJIKISTAN':
      return 'bg-purple-100 text-purple-600';
    case 'READY_FOR_PICKUP':
      return 'bg-green-100 text-green-600';
    case 'PICKED_UP':
      return 'bg-gray-100 text-gray-500';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const PendingPickupPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { supabase } = useSupabase();
  const { user } = useUser();
  const [items, setItems] = useState<PendingPickupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPendingPickupItems();
    }
  }, [user]);

  const fetchPendingPickupItems = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const pendingItems: PendingPickupItem[] = [];

      // 1. 获取全款购买订单（full_purchase_orders）- 未提货的
      try {
        const { data: fullPurchaseOrders, error: fullPurchaseError } = await (supabase as any)
          .from('full_purchase_orders')
          .select(`
            id, 
            lottery_id, 
            quantity, 
            total_amount,
            created_at, 
            status,
            logistics_status,
            pickup_code,
            lotteries(id, title, title_i18n, image_url, image_urls, currency)
          `)
          .eq('user_id', user.id)
          .eq('status', 'PAID')
          .neq('logistics_status', 'PICKED_UP')
          .order('created_at', { ascending: false });

        if (fullPurchaseError) {
          console.error('Failed to fetch full purchase orders:', fullPurchaseError);
        } else if (fullPurchaseOrders && Array.isArray(fullPurchaseOrders)) {
          fullPurchaseOrders.forEach((order: any) => {
            const lottery = order.lotteries;
            if (lottery) {
              const title = getLocalizedText(lottery.title_i18n, i18n.language) || lottery.title;
              const image = lottery.image_urls?.[0] || lottery.image_url || '';
              
              pendingItems.push({
                id: order.id,
                type: 'full_purchase',
                productId: lottery.id,
                productTitle: title,
                productImage: image,
                price: order.total_amount,
                currency: lottery.currency || 'TJS',
                quantity: order.quantity,
                pickupCode: order.pickup_code,
                createdAt: order.created_at,
                status: order.status,
                logisticsStatus: order.logistics_status,
                orderDetailLink: `/full-purchase-orders/${order.id}`
              });
            }
          });
        }
      } catch (err) {
        console.error('Error fetching full purchase orders:', err);
      }

      // 2. 获取中奖记录（prizes）- 未提货的
      try {
        const { data: prizes, error: prizesError } = await (supabase as any)
          .from('prizes')
          .select(`
            id, 
            lottery_id, 
            created_at, 
            status,
            logistics_status,
            pickup_code,
            lotteries(id, title, title_i18n, image_url, image_urls, currency, ticket_price)
          `)
          .eq('user_id', user.id)
          .eq('status', 'WON')
          .neq('logistics_status', 'PICKED_UP')
          .order('created_at', { ascending: false });

        if (prizesError) {
          console.error('Failed to fetch prizes:', prizesError);
        } else if (prizes && Array.isArray(prizes)) {
          prizes.forEach((prize: any) => {
            const lottery = prize.lotteries;
            if (lottery) {
              const title = getLocalizedText(lottery.title_i18n, i18n.language) || lottery.title;
              const image = lottery.image_urls?.[0] || lottery.image_url || '';
              
              pendingItems.push({
                id: prize.id,
                type: 'prize',
                productId: lottery.id,
                productTitle: title,
                productImage: image,
                price: lottery.ticket_price || 0,
                currency: lottery.currency || 'TJS',
                quantity: 1,
                pickupCode: prize.pickup_code,
                createdAt: prize.created_at,
                status: prize.status,
                logisticsStatus: prize.logistics_status,
                orderDetailLink: `/prizes/${prize.id}`
              });
            }
          });
        }
      } catch (err) {
        console.error('Error fetching prizes:', err);
      }

      // 3. 获取拼团中奖记录（group_buy_results）- 未提货的
      try {
        const { data: groupBuyResults, error: groupBuyResultsError } = await (supabase as any)
          .from('group_buy_results')
          .select(`
            id, 
            product_id, 
            session_id, 
            created_at, 
            status,
            logistics_status,
            pickup_code,
            group_buy_products(id, title, description, image_url, images, price_per_person, group_size),
            group_buy_sessions(id, session_code, current_participants, expires_at)
          `)
          .eq('user_id', user.id)
          .eq('status', 'WON')
          .neq('logistics_status', 'PICKED_UP')
          .order('created_at', { ascending: false });

        if (groupBuyResultsError) {
          console.error('Failed to fetch group buy results:', groupBuyResultsError);
        } else if (groupBuyResults && Array.isArray(groupBuyResults)) {
          groupBuyResults.forEach((result: any) => {
            const product = result.group_buy_products;
            const session = result.group_buy_sessions;
            
            if (product) {
              // 处理多语言标题
              let title = '';
              if (typeof product.title === 'object') {
                title = product.title[i18n.language] || product.title.zh || product.title.en || '';
              } else {
                title = product.title || '';
              }

              const image = product.images?.[0] || product.image_url || '';
              
              pendingItems.push({
                id: result.id,
                type: 'groupbuy',
                productId: product.id,
                productTitle: title,
                productImage: image,
                price: product.price_per_person,
                currency: 'TJS',
                quantity: 1,
                sessionCode: session?.session_code,
                pickupCode: result.pickup_code,
                createdAt: result.created_at,
                status: result.status,
                logisticsStatus: result.logistics_status,
                orderDetailLink: `/groupbuy-results/${result.id}`
              });
            }
          });
        }
      } catch (groupBuyErr) {
        console.error('Error fetching group buy results:', groupBuyErr);
      }

      // 按创建时间倒序排列（新到旧）
      pendingItems.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setItems(pendingItems);
    } catch (error) {
      console.error('Failed to fetch pending pickup items:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemClick = (item: PendingPickupItem) => {
    if (item.orderDetailLink) {
      navigate(item.orderDetailLink);
    }
  };

  // 获取类型显示文本
  const getTypeText = (type: string): string => {
    switch (type) {
      case 'full_purchase':
        return t('order.fullPurchase') || '全款购买';
      case 'prize':
        return t('order.prize') || '中奖商品';
      case 'groupbuy':
        return t('order.groupBuy') || '拼团中奖';
      case 'lottery':
        return t('order.lottery') || '积分商城';
      default:
        return '';
    }
  };

  return (
    <div className="pb-20 min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">
            {t('profile.pendingPickup') || '待提货'}
          </h1>
          <div className="w-10" />
        </div>
      </div>

      {/* 内容区域 */}
      <div className="px-4 py-4 max-w-2xl mx-auto">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse shadow-sm">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-gray-100 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-12 text-center shadow-sm"
          >
            <CubeIcon className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">
              {t('profile.noPendingPickup') || '暂无待提货商品'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {t('profile.pendingPickupHint') || '完成订单后，商品将在此显示'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => (
              <motion.button
                key={`${item.type}-${item.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleItemClick(item)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-left"
              >
                <div className="flex gap-4">
                  {/* 商品图片 */}
                  <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {item.productImage ? (
                      <img
                        src={item.productImage}
                        alt={item.productTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <CubeIcon className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* 商品信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {item.productTitle}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {getTypeText(item.type)}
                          {item.participationCode && ` • 参与码: ${item.participationCode}`}
                          {item.sessionCode && ` • 会话码: ${item.sessionCode}`}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-green-600">
                          {formatCurrency(item.currency, item.price)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.quantity > 1 ? `×${item.quantity}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* 物流状态标签 */}
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${getLogisticsStatusColor(item.logisticsStatus)}`}>
                        <TruckIcon className="w-3 h-3" />
                        {getLogisticsStatusText(item.logisticsStatus, t)}
                      </span>
                      {item.pickupCode && item.logisticsStatus === 'READY_FOR_PICKUP' && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs font-medium rounded-full">
                          提货码: {item.pickupCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingPickupPage;
