import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import {
  PhotoIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  ShareIcon,
  PlusIcon,
  FunnelIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

interface Showoff {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  lottery_id: string;
  lottery_title: string;
  prize_name: string;
  prize_image: string;
  content: string;
  images: string[];
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

const ShowoffPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const [showoffs, setShowoffs] = useState<Showoff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'following' | 'popular'>('all');

  const fetchShowoffs = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: 调用实际API获取晒单, 传入 filter 参数
      // 这里的mock数据没有根据 filter 过滤，但在实际应用中应该会根据 filter 过滤
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockShowoffs: Showoff[] = [
        {
          id: '1',
          user_id: 'user1',
          user_name: 'User***123',
          lottery_id: 'lottery1',
          lottery_title: 'iPhone 15 Pro Max 夺宝',
          prize_name: 'iPhone 15 Pro Max 256GB',
          prize_image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800',
          content: '终于中奖了!感谢平台,iPhone 15 Pro Max到手,手感超棒!推荐大家来试试运气 🎉',
          images: [
            'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800',
            'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800'
          ],
          likes_count: 156,
          comments_count: 23,
          is_liked: false,
          status: 'APPROVED',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          user_id: 'user2',
          user_name: 'User***456',
          lottery_id: 'lottery2',
          lottery_title: 'MacBook Pro 夺宝',
          prize_name: 'MacBook Pro 14" M3',
          prize_image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800',
          content: '人生第一台MacBook!太开心了,性能强大,屏幕超美!',
          images: [
            'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800'
          ],
          likes_count: 89,
          comments_count: 12,
          is_liked: true,
          status: 'APPROVED',
          created_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: '3',
          user_id: 'user3',
          user_name: 'User***789',
          lottery_id: 'lottery3',
          lottery_title: 'AirPods Pro 夺宝',
          prize_name: 'AirPods Pro 2代',
          prize_image: 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=800',
          content: '降噪效果一流,音质也很棒!值得拥有!',
          images: [
            'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=800'
          ],
          likes_count: 45,
          comments_count: 8,
          is_liked: false,
          status: 'APPROVED',
          created_at: new Date(Date.now() - 172800000).toISOString()
        }
      ];

      setShowoffs(mockShowoffs);
    } catch (error) {
      console.error('Failed to fetch showoffs:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    fetchShowoffs();
  }, [fetchShowoffs]);

  const handleLike = async (showoffId: string) => {
    try {
      // TODO: 调用API点赞
      setShowoffs(prev =>
        prev.map(showoff =>
          showoff.id === showoffId
            ? {
                ...showoff,
                is_liked: !showoff.is_liked,
                likes_count: showoff.is_liked ? showoff.likes_count - 1 : showoff.likes_count + 1
              }
            : showoff
        )
      );
    } catch (error) {
      console.error('Failed to like showoff:', error);
      toast.error(t('error.networkError'));
    }
  };

  const handleShare = (showoff: Showoff) => {
    const text = `${showoff.user_name}在LuckyMart中奖了${showoff.prize_name}!快来看看吧!`;
    const url = `${window.location.origin}/showoff/${showoff.id}`;

    if (navigator.share) {
      navigator.share({
        title: '晒单分享',
        text: text,
        url: url
      }).catch(err => console.log('分享失败:', err));
    } else {
      navigator.clipboard.writeText(url);
      toast.success('链接已复制到剪贴板');
    }
  };

  const handleCreateShowoff = () => {
    navigate('/showoff/create');
  };

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-6 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">晒单广场</h1>
          <button
            onClick={handleCreateShowoff}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
          >
            <PlusIcon className="w-5 h-5" />
            <span>发布晒单</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2">
          {[
            { key: 'all', label: '全部' },
            { key: 'following', label: '关注' },
            { key: 'popular', label: '热门' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Showoffs List */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : showoffs.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <PhotoIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无晒单内容</p>
            <p className="text-sm text-gray-400 mt-2">成为第一个分享中奖喜悦的人</p>
            <button
              onClick={handleCreateShowoff}
              className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              立即发布
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {showoffs.map((showoff, index) => (
              <motion.div
                key={showoff.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >
                {/* User Info */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
                      {showoff.user_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{showoff.user_name}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(showoff.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 px-3 py-1 bg-yellow-100 rounded-full">
                    <TrophyIcon className="w-4 h-4 text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-700">中奖</span>
                  </div>
                </div>

                {/* Prize Info */}
                <div className="px-4 pb-3">
                  <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                    <TrophyIcon className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{showoff.prize_name}</p>
                      <p className="text-xs text-gray-500 truncate">{showoff.lottery_title}</p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="px-4 pb-3">
                  <p className="text-gray-700 leading-relaxed">{showoff.content}</p>
                </div>

                {/* Images */}
                {showoff.images.length > 0 && (
                  <div className={`px-4 pb-3 grid gap-2 ${
                    showoff.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                  }`}>
                    {showoff.images.map((image, idx) => (
                      <div
                        key={idx}
                        className={`relative rounded-lg overflow-hidden ${
                          showoff.images.length === 1 ? 'aspect-[4/3]' : 'aspect-square'
                        }`}
                      >
                        <img
                          src={image}
                          alt={`晒单图片${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    <button
                      onClick={() => handleLike(showoff.id)}
                      className="flex items-center space-x-2 group"
                    >
                      {showoff.is_liked ? (
                        <HeartIconSolid className="w-6 h-6 text-red-500" />
                      ) : (
                        <HeartIcon className="w-6 h-6 text-gray-400 group-hover:text-red-500 transition-colors" />
                      )}
                      <span className={`text-sm font-medium ${
                        showoff.is_liked ? 'text-red-500' : 'text-gray-500 group-hover:text-red-500'
                      }`}>
                        {showoff.likes_count}
                      </span>
                    </button>

                    <button className="flex items-center space-x-2 group">
                      <ChatBubbleLeftIcon className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      <span className="text-sm font-medium text-gray-500 group-hover:text-blue-500">
                        {showoff.comments_count}
                      </span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleShare(showoff)}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <ShareIcon className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">分享</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShowoffPage;
