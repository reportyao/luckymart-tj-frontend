import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import {
  ArrowLeftIcon,
  PhotoIcon,
  XMarkIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface WinningLottery {
  id: string;
  lottery_id: string;
  lottery_title: string;
  prize_name: string;
  prize_image: string;
  winning_number: string;
  draw_time: string;
}

const ShowoffCreatePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const [winningLotteries, setWinningLotteries] = useState<WinningLottery[]>([]);
  const [selectedLottery, setSelectedLottery] = useState<string>('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLotteries, setIsLoadingLotteries] = useState(true);

  const fetchWinningLotteries = useCallback(async () => {
    setIsLoadingLotteries(true);
    try {
      // TODO: 调用实际API获取中奖彩票
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockLotteries: WinningLottery[] = [
        {
          id: '1',
          lottery_id: 'lottery1',
          lottery_title: 'iPhone 15 Pro Max 夺宝',
          prize_name: 'iPhone 15 Pro Max 256GB',
          prize_image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400',
          winning_number: '001',
          draw_time: new Date().toISOString()
        },
        {
          id: '2',
          lottery_id: 'lottery2',
          lottery_title: 'MacBook Pro 夺宝',
          prize_name: 'MacBook Pro 14" M3',
          prize_image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400',
          winning_number: '015',
          draw_time: new Date(Date.now() - 86400000).toISOString()
        }
      ];

      setWinningLotteries(mockLotteries);
    } catch (error) {
      console.error('Failed to fetch winning lotteries:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoadingLotteries(false);
    }
  }, [t]);

  useEffect(() => {
    fetchWinningLotteries();
  }, [fetchWinningLotteries]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (images.length + files.length > 9) {
      toast.error('最多上传9张图片');
      return;
    }

    // TODO: 实际上传到服务器
    // 这里模拟上传
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setImages(prev => [...prev, e.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedLottery) {
      toast.error('请选择要晒单的中奖记录');
      return;
    }

    if (!content.trim()) {
      toast.error('请输入晒单内容');
      return;
    }

    if (content.length < 10) {
      toast.error('晒单内容至少10个字');
      return;
    }

    if (images.length === 0) {
      toast.error('请至少上传1张图片');
      return;
    }

    setIsLoading(true);
    try {
      // TODO: 调用API提交晒单
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast.success('晒单发布成功,等待审核');
      navigate('/showoff');
    } catch (error) {
      console.error('Failed to create showoff:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const selectedLotteryData = winningLotteries.find(l => l.id === selectedLottery);

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
            <span>返回</span>
          </button>
          <h1 className="text-lg font-bold text-gray-900">发布晒单</h1>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '发布中...' : '发布'}
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Select Winning Lottery */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3">选择中奖记录</h3>
          {isLoadingLotteries ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : winningLotteries.length === 0 ? (
            <div className="text-center py-8">
              <TrophyIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">暂无中奖记录</p>
              <p className="text-sm text-gray-400 mt-1">参与夺宝活动,中奖后即可晒单</p>
            </div>
          ) : (
            <div className="space-y-2">
              {winningLotteries.map((lottery) => (
                <button
                  key={lottery.id}
                  onClick={() => setSelectedLottery(lottery.id)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg border-2 transition-all ${
                    selectedLottery === lottery.id
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img
                    src={lottery.prize_image}
                    alt={lottery.prize_name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900">{lottery.prize_name}</p>
                    <p className="text-sm text-gray-500">{lottery.lottery_title}</p>
                    <p className="text-xs text-gray-400 mt-1">中奖号码: {lottery.winning_number}</p>
                  </div>
                  {selectedLottery === lottery.id && (
                    <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Input */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3">晒单内容</h3>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="分享你的中奖喜悦,说说你的感受吧...(至少10个字)"
            className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            maxLength={500}
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-sm text-gray-500">
              {content.length}/500
            </p>
            {content.length > 0 && content.length < 10 && (
              <p className="text-sm text-red-500">至少10个字</p>
            )}
          </div>
        </div>

        {/* Image Upload */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3">上传图片 (最多9张)</h3>
          <div className="grid grid-cols-3 gap-3">
            {images.map((image, index) => (
              <div key={index} className="relative aspect-square">
                <img
                  src={image}
                  alt={`上传图片${index + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            {images.length < 9 && (
              <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all">
                <PhotoIcon className="w-8 h-8 text-gray-400" />
                <span className="text-xs text-gray-500 mt-2">上传图片</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            * 支持JPG、PNG格式,单张图片不超过5MB
          </p>
        </div>

        {/* Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="font-medium text-blue-900 mb-2">温馨提示</h4>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• 请上传真实的中奖照片,虚假晒单将被删除</li>
            <li>• 晒单内容需经过审核后才会显示</li>
            <li>• 优质晒单有机会获得平台奖励</li>
            <li>• 请勿发布违法违规、广告等不当内容</li>
          </ul>
        </div>

        {/* Preview */}
        {selectedLotteryData && content && images.length > 0 && (
          <div className="bg-white rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">预览</h3>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
                  {user?.telegram_username?.charAt(0) || user?.first_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.telegram_username || user?.first_name || '用户'}</p>
                  <p className="text-xs text-gray-500">刚刚</p>
                </div>
              </div>

              <div className="mb-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                <div className="flex items-center space-x-2">
                  <TrophyIcon className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {selectedLotteryData.prize_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {selectedLotteryData.lottery_title}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-gray-700 mb-3">{content}</p>

              <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {images.slice(0, 4).map((image, idx) => (
                  <div
                    key={idx}
                    className={`relative rounded-lg overflow-hidden ${
                      images.length === 1 ? 'aspect-[4/3]' : 'aspect-square'
                    }`}
                  >
                    <img src={image} alt={`预览${idx + 1}`} className="w-full h-full object-cover" />
                    {idx === 3 && images.length > 4 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-xl font-bold">+{images.length - 4}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShowoffCreatePage;
