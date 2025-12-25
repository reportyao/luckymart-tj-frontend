import React, { useState, useEffect, useCallback } from 'react';

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import {
  ArrowLeftIcon,
  PhotoIcon,
  XMarkIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { uploadImage } from '@/lib/uploadImage';
import { LazyImage } from '../components/LazyImage';
import toast from 'react-hot-toast';
import { showoffService } from '@/lib/supabase';

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
      // 1. 获取用户的所有中奖记录
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) {
        throw new Error('未登录');
      }

      const prizesResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-prizes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ session_token: sessionToken }),
        }
      );

      if (!prizesResponse.ok) {
        throw new Error('获取中奖记录失败');
      }

      const prizesData = await prizesResponse.json();
      if (!prizesData.success) {
        throw new Error(prizesData.error || '获取中奖记录失败');
      }

      const prizes = prizesData.data || [];

      // 2. 获取已发布的晒单（通过 prize_id 关联）
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const showoffsResponse = await fetch(
        `${supabaseUrl}/rest/v1/showoffs?user_id=eq.${user?.id}&select=prize_id`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          },
        }
      );

      const publishedShowoffs = showoffsResponse.ok ? await showoffsResponse.json() : [];
      const publishedPrizeIds = new Set(publishedShowoffs.map((s: any) => s.prize_id));

      // 3. 过滤掉已发布晒单的中奖记录，并按中奖时间从新到旧排序
      const availablePrizes = prizes
        .filter((prize: any) => !publishedPrizeIds.has(prize.id))
        .sort((a: any, b: any) => new Date(b.won_at).getTime() - new Date(a.won_at).getTime());

      // 4. 转换为 WinningLottery 格式
      const winningLotteries: WinningLottery[] = availablePrizes.map((prize: any) => ({
        id: prize.id,
        lottery_id: prize.lottery_id,
        lottery_title: prize.lottery?.title?.zh || '未知夺宝',
        prize_name: prize.lottery?.title?.zh || '未知奖品',
        prize_image: prize.lottery?.image_url || 'https://via.placeholder.com/400',
        winning_number: prize.winning_number || '',
        draw_time: prize.won_at,
      }));

      setWinningLotteries(winningLotteries);
    } catch (error) {
      console.error('Failed to fetch winning lotteries:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoadingLotteries(false);
    }
  }, [t, user]);

  useEffect(() => {
    fetchWinningLotteries();
  }, [fetchWinningLotteries]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);

    if (images.length + newFiles.length > 9) {
      toast.error(t('showoff.maxImagesError'));
      return;
    }

    setIsLoading(true);
    try {
      const uploadedUrls: string[] = [];
      
      for (const file of newFiles) {
        // 1. 上传图片 (uploadImage 内部已包含压缩和 WebP 转换)
        const publicUrl = await uploadImage(file, true, 'payment-proofs', 'showoff-images');
        uploadedUrls.push(publicUrl);
      }

      setImages(prev => [...prev, ...uploadedUrls]);
      toast.success(t('showoff.imagesUploadedAndOptimized'));

    } catch (error) {
      console.error('Image compression/upload error:', error);
      toast.error(t('showoff.imageUploadFailed'));
    } finally {
      setIsLoading(false);
      // 清空文件输入框，以便再次选择相同文件
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedLottery) {
      toast.error(t('showoff.selectWinningRecordError'));
      return;
    }

    if (!content.trim()) {
      toast.error(t('showoff.contentRequiredError'));
      return;
    }

    if (content.length < 10) {
      toast.error(t('showoff.minContentLengthError'));
      return;
    }

    if (images.length === 0) {
      toast.error(t('showoff.imageRequiredError'));
      return;
    }

    setIsLoading(true);
    try {
      // 获取选中的中奖记录
      const selectedLotteryData = winningLotteries.find(l => l.id === selectedLottery);
      if (!selectedLotteryData) {
        toast.error(t('showoff.prizeNotFound'));
        return;
      }

      // 调用晒单创建 API
      await showoffService.createShowoff({
        lottery_id: selectedLotteryData.lottery_id, // 使用 lottery_id 而不是 id
        content: content.trim(),
        images: images,
        user_id: user?.id, // 传入 user_id 避免 session 问题
      });

      toast.success(t('showoff.showoffSuccessPending'));
      navigate('/showoff');
    } catch (error) {
      console.error('Failed to create showoff:', error);
      toast.error(error instanceof Error ? error.message : t('error.networkError'));
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
            <span>{t('common.back')}</span>
          </button>
          <h1 className="text-lg font-bold text-gray-900">{t('showoff.createShowoff')}</h1>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? `${t('showoff.publish')}...` : t('showoff.publish')}
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Select Winning Lottery */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3">{t('showoff.selectPrizeRecord')}</h3>
          {isLoadingLotteries ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : winningLotteries.length === 0 ? (
            <div className="text-center py-8">
              <TrophyIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t('showoff.noPrizes')}</p>
              <p className="text-sm text-gray-400 mt-1">{t('showoff.noPrizesHint')}</p>
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
                  <LazyImage
                    src={lottery.prize_image}
                    alt={lottery.prize_name}
                    className="w-16 h-16 object-cover rounded-lg"
                    width={64}
                    height={64}
                  />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900">{lottery.prize_name}</p>
                    <p className="text-sm text-gray-500">{lottery.lottery_title}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('showoff.winningNumber')}: {lottery.winning_number}</p>
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
          <h3 className="font-semibold text-gray-900 mb-3">{t('showoff.content')}</h3>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('showoff.contentPlaceholderLong')}
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
	                <LazyImage
	                  src={image}
	                  alt={`上传图片${index + 1}`}
	                  className="w-full h-full object-cover rounded-lg"
	                  width={100} // 假设网格项宽度约为 100px
	                  height={100}
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
                  {user?.telegram_username?.charAt(0) || user?.telegram_username?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.telegram_username || user?.telegram_username || '用户'}</p>
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
	                    <LazyImage src={image} alt={`预览${idx + 1}`} className="w-full h-full object-cover" />
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
