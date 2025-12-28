import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ClockIcon,


  TicketIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

interface Order {
  id: string;
  order_number: string;
  type: 'LOTTERY_PURCHASE' | 'COIN_EXCHANGE' | 'DEPOSIT' | 'WITHDRAWAL';
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  amount: number;
  currency: string;
  description: string;
  lottery_id?: string;
  lottery_title?: string;
  purchased_numbers?: string;
  created_at: string;
  updated_at: string;
}

const OrderPage: React.FC = () => {
  const { t } = useTranslation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: 调用实际API获取订单
      // 这里使用mock数据
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockOrders: Order[] = [
        {
          id: '1',
          order_number: 'ORD20250107001',
          type: 'LOTTERY_PURCHASE',
          status: 'COMPLETED',
          amount: 10.00,
          currency: 'TJS',
          description: '购买彩票',
          lottery_id: 'lottery1',
          lottery_title: 'iPhone 15 Pro Max 积分商城',
          purchased_numbers: '001,002,003',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2',
          order_number: 'ORD20250107002',
          type: 'COIN_EXCHANGE',
          status: 'COMPLETED',
          amount: 50.00,
          currency: 'TJS',
          description: '余额兑换积分商城币',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          updated_at: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: '3',
          order_number: 'ORD20250106001',
          type: 'DEPOSIT',
          status: 'COMPLETED',
          amount: 100.00,
          currency: 'TJS',
          description: '钱包充值',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          updated_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: '4',
          order_number: 'ORD20250105001',
          type: 'LOTTERY_PURCHASE',
          status: 'COMPLETED',
          amount: 20.00,
          currency: 'TJS',
          description: '购买彩票',
          lottery_id: 'lottery2',
          lottery_title: 'MacBook Pro 积分商城',
          purchased_numbers: '015,016',
          created_at: new Date(Date.now() - 172800000).toISOString(),
          updated_at: new Date(Date.now() - 172800000).toISOString()
        },
        {
          id: '5',
          order_number: 'ORD20250104001',
          type: 'WITHDRAWAL',
          status: 'PENDING',
          amount: 200.00,
          currency: 'TJS',
          description: '提现申请',
          created_at: new Date(Date.now() - 259200000).toISOString(),
          updated_at: new Date(Date.now() - 259200000).toISOString()
        }
      ];

      setOrders(mockOrders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const filterOrders = useCallback(() => {
    let filtered = [...orders];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(order =>
        order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.lottery_title?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(order => order.type === typeFilter);
    }

    setFilteredOrders(filtered);
  }, [orders, searchQuery, statusFilter, typeFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    filterOrders();
  }, [filterOrders]);

  const getOrderTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      LOTTERY_PURCHASE: t('order.lotteryPurchase'),
      COIN_EXCHANGE: t('order.coinExchange'),
      DEPOSIT: '充值',
      WITHDRAWAL: '提现'
    };
    return labels[type] || type;
  };

  const getOrderStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      PENDING: t('order.pending'),
      COMPLETED: t('order.completed'),
      CANCELLED: t('order.cancelled'),
      FAILED: t('order.failed')
    };
    return labels[status] || status;
  };



  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      case 'FAILED':
      case 'CANCELLED':
        return 'bg-red-100 text-red-700';
      case 'PENDING':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'LOTTERY_PURCHASE':
        return <TicketIcon className="w-5 h-5" />;
      case 'COIN_EXCHANGE':
        return <ArrowPathIcon className="w-5 h-5" />;
      default:
        return <ClockIcon className="w-5 h-5" />;
    }
  };

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-6 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-900">{t('order.myOrders')}</h1>
        
        {/* Search Bar */}
        <div className="mt-4 flex space-x-2">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索订单号或商品名称..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 rounded-lg border transition-colors ${
              showFilters
                ? 'bg-blue-50 border-blue-500 text-blue-600'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('order.orderStatus')}
              </label>
              <div className="flex flex-wrap gap-2">
                {['all', 'PENDING', 'COMPLETED', 'CANCELLED', 'FAILED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'all' ? t('common.all') : getOrderStatusLabel(status)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('order.orderType')}
              </label>
              <div className="flex flex-wrap gap-2">
                {['all', 'LOTTERY_PURCHASE', 'COIN_EXCHANGE', 'DEPOSIT', 'WITHDRAWAL'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      typeFilter === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type === 'all' ? t('common.all') : getOrderTypeLabel(type)}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Orders List */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <TicketIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('order.noOrders')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Order Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      {getTypeIcon(order.type)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{order.order_number}</p>
                      <p className="text-sm text-gray-500">{formatDateTime(order.created_at)}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getOrderStatusLabel(order.status)}
                  </span>
                </div>

                {/* Order Details */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{t('order.orderType')}</span>
                    <span className="text-sm font-medium text-gray-900">{getOrderTypeLabel(order.type)}</span>
                  </div>
                  
                  {order.lottery_title && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">商品名称</span>
                      <span className="text-sm font-medium text-gray-900">{order.lottery_title}</span>
                    </div>
                  )}

                  {order.purchased_numbers && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{t('order.purchasedNumbers')}</span>
                      <span className="text-sm font-medium text-blue-600">{order.purchased_numbers}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-600">{t('order.orderAmount')}</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(order.currency, order.amount)}
                    </span>
                  </div>
                </div>

                {/* Order Actions */}
                <div className="mt-4 flex space-x-2">
                  <button className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
                    {t('order.viewDetails')}
                  </button>
                  {order.status === 'PENDING' && order.type === 'LOTTERY_PURCHASE' && (
                    <button className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors">
                      取消订单
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderPage;
