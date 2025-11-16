import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { Showoff } from '../lib/supabase';
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



const ShowoffPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const { showoffService } = useSupabase();
  const [showoffs, setShowoffs] = useState<Showoff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'following' | 'popular'>('all');

  const fetchShowoffs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await showoffService.getApprovedShowoffs(filter);
      setShowoffs(data);
    } catch (error) {
      console.error('Error fetching showoffs:', error);
      toast.error(t('error.networkError'));
    } finally {
      setIsLoading(false);
    }
  }, [t, filter, showoffService]);

  useEffect(() => {
    fetchShowoffs();
  }, [fetchShowoffs]);

  const handleLike = async (showoffId: string) => {
    try {
      const isLiked = showoffs.find(s => s.id === showoffId)?.is_liked;
      if (isLiked) {
        await showoffService.unlikeShowoff(showoffId);
      } else {
        await showoffService.likeShowoff(showoffId);
      }
      // 乐观更新
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
    } catch (error: any) {
      toast.error(error.message || t('error.networkError'));
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
