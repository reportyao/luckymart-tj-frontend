import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { ShowoffWithDetails } from '../lib/supabase';
import {
  PhotoIcon,
  HeartIcon,
  ShareIcon,
  PlusIcon,
  TrophyIcon,
  SparklesIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { LazyImage } from '../components/LazyImage';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 10;

const ShowoffPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const { showoffService } = useSupabase();

  const [showoffs, setShowoffs] = useState<ShowoffWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'following' | 'popular'>('all');
  const [page, setPage] = useState(0);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const fetchShowoffs = useCallback(async (pageNum: number, isLoadMore: boolean = false) => {
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const offset = pageNum * ITEMS_PER_PAGE;
      const limit = ITEMS_PER_PAGE;

      // 1. 先获取晒单数据（不使用关联查询）
      const showoffsResponse = await fetch(
        `${supabaseUrl}/rest/v1/showoffs?status=eq.APPROVED&select=*&order=created_at.desc&limit=${limit}&offset=${offset}`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!showoffsResponse.ok) {
        throw new Error('获取晒单失败');
      }

      const showoffsData = await showoffsResponse.json();

      // 2. 获取所有用户ID和彩票ID
      const userIds = [...new Set(showoffsData.map((s: any) => s.user_id).filter(Boolean))];
      const lotteryIds = [...new Set(showoffsData.map((s: any) => s.lottery_id).filter(Boolean))];

      // 3. 批量获取用户信息
      let usersMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const usersResponse = await fetch(
          `${supabaseUrl}/rest/v1/users?id=in.(${userIds.join(',')})&select=id,telegram_username,first_name,avatar_url`,
          {
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            },
          }
        );
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          usersData.forEach((u: any) => {
            usersMap[u.id] = u;
          });
        }
      }

      // 4. 批量获取彩票信息
      let lotteriesMap: Record<string, any> = {};
      if (lotteryIds.length > 0) {
        const lotteriesResponse = await fetch(
          `${supabaseUrl}/rest/v1/lotteries?id=in.(${lotteryIds.join(',')})&select=id,title,image_url`,
          {
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            },
          }
        );
        if (lotteriesResponse.ok) {
          const lotteriesData = await lotteriesResponse.json();
          lotteriesData.forEach((l: any) => {
            lotteriesMap[l.id] = l;
          });
        }
      }

      // 5. 合并数据
      const enrichedData = showoffsData.map((showoff: any) => ({
        ...showoff,
        user: usersMap[showoff.user_id] || null,
        lottery: lotteriesMap[showoff.lottery_id] || null,
      }));

      // 如果是加载更多，追加到现有数据
      if (isLoadMore) {
        setShowoffs(prev => [...prev, ...enrichedData]);
      } else {
        setShowoffs(enrichedData);
      }

      // 如果返回的数据少于每页数量，说明没有更多了
      setHasMore(showoffsData.length === ITEMS_PER_PAGE);
    } catch (error: any) {
      console.error('Error fetching showoffs:', error);
      setError(error.message || t('error.networkError'));
      
      // 弱网环境下显示友好提示
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        toast.error(t('error.networkSlow'));
      } else {
        toast.error(t('error.networkError'));
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [t]);

  useEffect(() => {
    // 重置状态并加载第一页
    setPage(0);
    setShowoffs([]);
    setHasMore(true);
    fetchShowoffs(0, false);
  }, [filter]);

  // 无限滚动加载
  useEffect(() => {
    if (isLoading || isLoadingMore || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchShowoffs(nextPage, true);
        }
      },
      { threshold: 0.5 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [page, hasMore, isLoading, isLoadingMore, fetchShowoffs]);

  const handleLike = async (showoffId: string) => {
    if (!user) {
      toast.error(t('auth.pleaseLogin'));
      return;
    }
    try {
      const isLiked = showoffs.find(s => s.id === showoffId)?.is_liked;
      if (isLiked) {
        await showoffService.unlikeShowoff(showoffId, user.id);
      } else {
        await showoffService.likeShowoff(showoffId, user.id);
      }
      // 乐观更新
      setShowoffs(prev =>
        prev.map(showoff =>
          showoff.id === showoffId
            ? {
                ...showoff,
                is_liked: !showoff.is_liked,
                likes_count: Math.max(0, showoff.is_liked ? showoff.likes_count - 1 : showoff.likes_count + 1)
              }
            : showoff
        )
      );
    } catch (error: any) {
      toast.error(error.message || t('error.networkError'));
    }
  };

  const handleShare = (showoff: ShowoffWithDetails) => {
    const text = `${showoff.user?.telegram_username || t('common.aUser')}在TezBarakat${t('showoff.won')}了!快来看看吧!`;
    const url = `${window.location.origin}/showoff/${showoff.id}`;

    if (navigator.share) {
      navigator.share({
        title: t('showoff.shareTitle'),
        text: text,
        url: url
      }).catch(err => console.log('分享失败:', err));
    } else {
      navigator.clipboard.writeText(url);
      toast.success(t('common.linkCopied'));
    }
  };

  const handleCreateShowoff = () => {
    navigate('/showoff/create');
  };

  const handleRetry = () => {
    setPage(0);
    setShowoffs([]);
    setHasMore(true);
    fetchShowoffs(0, false);
  };

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-6 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{t('showoff.showoffGallery')}</h1>
          <button
            onClick={handleCreateShowoff}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
          >
            <PlusIcon className="w-5 h-5" />
	            <span>{t('showoff.createShowoff')}</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2">
          {[
            { key: 'all', label: t('showoff.all') },
            { key: 'following', label: t('showoff.following') },
            { key: 'popular', label: t('showoff.popular') }
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
        {isLoading && showoffs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : error && showoffs.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <PhotoIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">{error}</p>
            <button
              onClick={handleRetry}
              className="flex items-center space-x-2 mx-auto px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <ArrowPathIcon className="w-5 h-5" />
              <span>重试</span>
            </button>
          </div>
        ) : showoffs.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <PhotoIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('showoff.noShowoffs')}</p>
            <p className="text-sm text-gray-400 mt-2">{t('showoff.beTheFirst')}</p>
            <button
              onClick={handleCreateShowoff}
              className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              {t('showoff.publishNow')}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {showoffs.map((showoff, index) => (
                <motion.div
                  key={showoff.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-xl shadow-sm overflow-hidden"
                >
                  {/* User Info */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
	                      {showoff.user?.telegram_username ? showoff.user.telegram_username.charAt(0) : 'U'}
                      </div>
                      <div>
	                      <p className="font-medium text-gray-900">{showoff.user?.telegram_username || 'Anonymous'}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(showoff.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Prize Info */}
                  <div className="px-4 pb-3">
                    <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                      <TrophyIcon className="w-5 h-5 text-orange-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {showoff.lottery?.title || showoff.lottery_title || t('showoff.unknownLottery')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-4 pb-3">
                    <p className="text-gray-700 leading-relaxed">{showoff.content}</p>
                  </div>

                  {/* Images */}
	                  {showoff.images && Array.isArray(showoff.images) && showoff.images.length > 0 && (
                    <div className={`px-4 pb-3 grid gap-2 ${
                      showoff.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                    }`}>
	                      {(showoff.images as string[]).map((image, idx) => (
                        <div
                          key={idx}
                          className={`relative rounded-lg overflow-hidden ${
                            (showoff.images as string[]).length === 1 ? 'aspect-[4/3]' : 'aspect-square'
                          }`}
                        >
	                          <LazyImage
	                            src={image}
	                            alt={`晒单图片${idx + 1}`}
	                            className="w-full h-full object-cover"
	                            width={200}
	                            height={200}
	                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 积分奖励显示 */}
                  {showoff.reward_coins && showoff.reward_coins > 0 && (
                    <div className="px-4 pb-3">
                      <div className="flex items-center space-x-2 p-2 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-200">
                        <SparklesIcon className="w-5 h-5 text-amber-500" />
                        <span className="text-sm font-medium text-amber-700">
                          {t('showoff.earnedCoins', { coins: showoff.reward_coins })}
                        </span>
                      </div>
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
                    </div>

                    <button
                      onClick={() => handleShare(showoff)}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <ShareIcon className="w-5 h-5 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">{t('common.share')}</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Load More Trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="py-8 flex justify-center">
                {isLoadingMore && (
                  <div className="flex items-center space-x-2 text-purple-600">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                    <span className="text-sm">加载中...</span>
                  </div>
                )}
              </div>
            )}

            {/* No More Data */}
            {!hasMore && showoffs.length > 0 && (
              <div className="py-8 text-center text-gray-400 text-sm">
                没有更多晒单了
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ShowoffPage;
