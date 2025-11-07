import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  TrophyIcon,
  TruckIcon,
  ShoppingBagIcon,
  TicketIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

interface Prize {
  id: string;
  lottery_id: string;
  lottery_period: string;
  lottery_title: string;
  lottery_image: string;
  winning_code: string;
  prize_value: number;
  status: 'PENDING' | 'SHIPPING' | 'SHIPPED' | 'RESOLD';
  won_at: string;
}

const MyPrizesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null);
  const [showShippingModal, setShowShippingModal] = useState(false);

  useEffect(() => {
    loadPrizes();
  }, []);

  const loadPrizes = async () => {
    setIsLoading(true);
    try {
      // TODO: 调用实际API
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 模拟数据
      const mockPrizes: Prize[] = [
        {
          id: '1',
          lottery_id: '20250107001',
          lottery_period: '20250107001',
          lottery_title: 'iPhone 15 Pro Max 256GB',
          lottery_image: 'https://images.unsplash.com/photo-1696446702183-cbd0674e0c99?w=400',
          winning_code: 'LM-20250107001-00045',
          prize_value: 1200,
          status: 'PENDING',
          won_at: new Date().toISOString()
        },
        {
          id: '2',
          lottery_id: '20250106001',
          lottery_period: '20250106001',
          lottery_title: 'AirPods Pro 2代',
          lottery_image: 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=400',
          winning_code: 'LM-20250106001-00023',
          prize_value: 300,
          status: 'SHIPPED',
          won_at: new Date(Date.now() - 86400000 * 3).toISOString()
        }
      ];

      setPrizes(mockPrizes);
    } catch (error) {
      toast.error('加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyShipping = (prize: Prize) => {
    setSelectedPrize(prize);
    setShowShippingModal(true);
  };

  const handleResell = (prize: Prize) => {
    navigate(`/market/create?prize_id=${prize.id}`);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: { text: '待处理', color: 'bg-yellow-100 text-yellow-700' },
      SHIPPING: { text: '配送中', color: 'bg-blue-100 text-blue-700' },
      SHIPPED: { text: '已送达', color: 'bg-green-100 text-green-700' },
      RESOLD: { text: '已转售', color: 'bg-gray-100 text-gray-700' }
    };
    const badge = badges[status as keyof typeof badges] || badges.PENDING;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center space-x-3 mb-4">
            <TrophyIcon className="w-8 h-8" />
            <h1 className="text-2xl font-bold">我的中奖</h1>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{prizes.length}</p>
              <p className="text-xs mt-1 opacity-90">总中奖</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{prizes.filter(p => p.status === 'PENDING').length}</p>
              <p className="text-xs mt-1 opacity-90">待处理</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">
                TJS{prizes.reduce((sum, p) => sum + p.prize_value, 0).toFixed(0)}
              </p>
              <p className="text-xs mt-1 opacity-90">总价值</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {prizes.map((prize, index) => (
          <motion.div
            key={prize.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-sm"
          >
            <div className="flex space-x-4 mb-4">
              <img
                src={prize.lottery_image}
                alt={prize.lottery_title}
                className="w-20 h-20 rounded-xl object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">期号: {prize.lottery_period}</span>
                  {getStatusBadge(prize.status)}
                </div>
                <h3 className="text-lg font-bold mb-2">{prize.lottery_title}</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <TicketIcon className="w-4 h-4" />
                  <span className="font-mono font-medium">{prize.winning_code}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <ClockIcon className="w-4 h-4" />
                <span>{formatDateTime(prize.won_at)}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">奖品价值</p>
                <p className="text-xl font-bold text-yellow-600">TJS{prize.prize_value.toFixed(2)}</p>
              </div>
            </div>

            {prize.status === 'PENDING' && (
              <div className="mt-4 pt-4 border-t flex space-x-3">
                <button
                  onClick={() => handleApplyShipping(prize)}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  <TruckIcon className="w-5 h-5" />
                  <span>申请发货</span>
                </button>
                <button
                  onClick={() => handleResell(prize)}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  <ShoppingBagIcon className="w-5 h-5" />
                  <span>转售</span>
                </button>
              </div>
            )}
          </motion.div>
        ))}

        {prizes.length === 0 && (
          <div className="text-center py-12">
            <TrophyIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">您还没有中奖记录</p>
            <button
              onClick={() => navigate('/lottery')}
              className="text-blue-600 font-medium hover:underline"
            >
              去参与夺宝 →
            </button>
          </div>
        )}
      </div>

      {/* 发货地址模态框 */}
      {showShippingModal && selectedPrize && (
        <ShippingModal
          prize={selectedPrize}
          onClose={() => {
            setShowShippingModal(false);
            setSelectedPrize(null);
          }}
          onSuccess={() => {
            setShowShippingModal(false);
            setSelectedPrize(null);
            loadPrizes();
          }}
        />
      )}
    </div>
  );
};

// 发货地址模态框组件
const ShippingModal: React.FC<{
  prize: Prize;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ prize, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    recipient_name: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // TODO: 调用实际API
      await new Promise(resolve => setTimeout(resolve, 1500));

      toast.success('发货申请已提交');
      onSuccess();
    } catch (error) {
      toast.error('提交失败,请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">填写收货地址</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              收货人姓名 *
            </label>
            <input
              type="text"
              required
              value={formData.recipient_name}
              onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入收货人姓名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              联系电话 *
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+992 XXX XXX XXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              详细地址 *
            </label>
            <textarea
              required
              rows={3}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="请输入详细地址"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                城市 *
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="杜尚别"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                邮编
              </label>
              <input
                type="text"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="734000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              备注
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="其他备注信息(可选)"
            />
          </div>

          <div className="pt-4 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '提交中...' : '确认提交'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default MyPrizesPage;
