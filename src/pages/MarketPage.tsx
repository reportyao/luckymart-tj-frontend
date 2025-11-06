import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import {
  ShoppingBagIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  ClockIcon,
  TicketIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

interface MarketListing {
  id: string;
  seller_id: string;
  seller_name: string;
  lottery_entry_id: string;
  lottery_id: string;
  lottery_title: string;
  lottery_image: string;
  ticket_numbers: string;
  original_price: number;
  selling_price: number;
  currency: string;
  discount_percentage: number;
  status: 'AVAILABLE' | 'SOLD' | 'CANCELLED';
  draw_time: string;
  created_at: string;
}

const MarketPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'price_low' | 'price_high' | 'discount'>('latest');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchListings();
  }, [sortBy]);

  const fetchListings = async () => {
    setIsLoading(true);
    try {
      // TODO: 调用实际API获取转售列表
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockListings: MarketListing[] = [
        {
          id: '1',
          seller_id: 'user1',
          seller_name: 'User***123',
          lottery_entry_id: 'entry1',
          lottery_id: 'lottery1',
          lottery_title: 'iPhone 15 Pro Max 夺宝',
          lottery_image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400',
          ticket_numbers: '023,024,025',
          original_price: 30,
          selling_price: 25,
          currency: 'TJS',
          discount_percentage: 17,
          status: 'AVAILABLE',
          draw_time: new Date(Date.now() + 7200000).toISOString(),
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          seller_id: 'user2',
          seller_name: 'User***456',
          lottery_entry_id: 'entry2',
          lottery_id: 'lottery2',
          lottery_title: 'MacBook Pro 夺宝',
          lottery_image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400',
          ticket_numbers: '045,046',
          original_price: 20,
          selling_price: 15,
          currency: 'TJS',
          discount_percentage: 25,
          status: 'AVAILABLE',
          draw_time: new Date(Date.now() + 14400000).toISOString(),
          created_at: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: '3',
          seller_id: 'user3',
          seller_name: 'User***789',
          lottery_entry_id: 'entry3',
          lottery_id: 'lottery3',
          lottery_title: 'AirPods Pro 夺宝',
          lottery_image: 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=400',
          ticket_numbers: '078',
          original_price: 10,
          selling_price: 8,
          currency: 'TJS',
          discount_percentage: 20,
          status: 'AVAILABLE',
          draw_time: new Date(Date.now() + 21600000).toISOString(),
          created_at: new Date(Date.now() - 7200000).toISOString()
        }
      ];

      // 排序
      let sorted = [...mockListings];
      switch (sortBy) {
        case 'price_low':
          sorted.sort((a, b) => a.selling_price - b.selling_price);
          break;
        case 'price_high':
          sorted.sort((a, b) => b.selling_price - a.selling_price);
          break;
        case 'discount':
          sorted.sort((a, b) => b.discount_percentage - a.discount_percentage);
          break;
        default:
          sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      setListings(sorted);
    } catch (error) {
      console.error('Failed to fetch listings:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const filteredListings = listings.filter(listing =>
    listing.lottery_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    listing.ticket_numbers.includes(searchQuery)
  );

  const handleBuy = (listing: MarketListing) => {
    navigate(`/market/${listing.id}`);
  };

  const handleCreateListing = () => {
    navigate('/market/create');
  };

  const getTimeRemaining = (drawTime: string) => {
    const now = new Date().getTime();
    const draw = new Date(drawTime).getTime();
    const diff = draw - now;

    if (diff <= 0) return '已开奖';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}天后开奖`;
    }
    return `${hours}小时${minutes}分钟后开奖`;
  };

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-6 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">转售市场</h1>
          <button
            onClick={handleCreateListing}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
          >
            <PlusIcon className="w-5 h-5" />
            <span>出售彩票</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索彩票名称或号码..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Sort Options */}
        <div className="flex items-center space-x-2 overflow-x-auto">
          {[
            { key: 'latest', label: '最新' },
            { key: 'price_low', label: '价格从低到高' },
            { key: 'price_high', label: '价格从高到低' },
            { key: 'discount', label: '折扣最大' }
          ].map((option) => (
            <button
              key={option.key}
              onClick={() => setSortBy(option.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                sortBy === option.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listings */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <ShoppingBagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无转售商品</p>
            <p className="text-sm text-gray-400 mt-2">购买的彩票可以在这里转售</p>
            <button
              onClick={handleCreateListing}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              出售彩票
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredListings.map((listing, index) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="flex">
                  {/* Image */}
                  <div className="w-32 h-32 flex-shrink-0">
                    <img
                      src={listing.lottery_image}
                      alt={listing.lottery_title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {listing.lottery_title}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <UserIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">{listing.seller_name}</span>
                        </div>
                      </div>
                      {listing.discount_percentage > 0 && (
                        <span className="flex-shrink-0 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">
                          -{listing.discount_percentage}%
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 mb-2">
                      <TicketIcon className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-600">
                        号码: {listing.ticket_numbers}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 mb-3">
                      <ClockIcon className="w-4 h-4 text-orange-600" />
                      <span className="text-sm text-orange-600">
                        {getTimeRemaining(listing.draw_time)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline space-x-2">
                        <span className="text-2xl font-bold text-green-600">
                          {formatCurrency(listing.selling_price, listing.currency)}
                        </span>
                        <span className="text-sm text-gray-400 line-through">
                          {formatCurrency(listing.original_price, listing.currency)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleBuy(listing)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        立即购买
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="px-4 pb-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="font-medium text-blue-900 mb-2">💡 转售说明</h4>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• 购买的彩票在开奖前可以转售</li>
            <li>• 转售价格由卖家自行设定</li>
            <li>• 购买转售彩票后,号码归属权转移给买家</li>
            <li>• 开奖后无法转售,请注意时间</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MarketPage;
