import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

// 全局缓存，避免每次切换 tab 都重新加载
interface ShowoffCache {
  data: ShowoffWithDetails[];
  timestamp: number;
  filter: string;
  hasMore: boolean;
  page: number;
}
let showoffCache: ShowoffCache | null = null;
const CACHE_DURATION = 2 * 60 * 1000; // 2分钟缓存

const ShowoffPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const { showoffService } = useSupabase();

  // 从缓存初始化状态
  const [showoffs, setShowoffs] = useState<ShowoffWithDetails[]>(() => {
    if (showoffCache && (Date.now() - showoffCache.timestamp) < CACHE_DURATION) {
      return showoffCache.data;
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    // 如果有有效缓存，不显示加载状态
    if (showoffCache && (Date.now() - showoffCache.timestamp) < CACHE_DURATION) {
      return false;
    }
    return true;
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'following' | 'popular'>(() => {
    // 从缓存恢复 filter
    if (showoffCache && (Date.now() - showoffCache.timestamp) < CACHE_DURATION) {
      return showoffCache.filter as any;
    }
    return 'all';
  });
  const [page, setPage] = useState(() => {
    // 从缓存恢复 page
    if (showoffCache && (Date.now() - showoffCache.timestamp) < CACHE_DURATION) {
      return showoffCache.page;
    }
    return 0;
  });
  const [hasMore, setHasMore] = useState(() => {
    if (showoffCache && (Date.now() - showoffCache.timestamp) < CACHE_DURATION) {
      return showoffCache.hasMore;
    }
    return true;
  });
  
  // 缓存数据更新
  useEffect(() => {
    if (showoffs.length > 0) {
      showoffCache = {
        data: showoffs,
        timestamp: Date.now(),
        filter,
        hasMore,
        page,
      };
    }
  }, [showoffs, filter, hasMore, page]);
  
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
    // 检查缓存是否有效且 filter 匹配
    const now = Date.now();
    if (showoffCache && 
        (now - showoffCache.timestamp) < CACHE_DURATION && 
        showoffCache.filter === filter &&
        showoffCache.data.length > 0) {
      // 缓存有效，跳过加载
      return;
    }
    
    // 重置状态并加载第一页
    setPage(0);
    setShowoffs([]);
    setHasMore(true);
    fetchShowoffs(0, false);
  }, [filter, fetchShowoffs]);

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

      {/* Floating Action Button (FAB) */}
      <motion.button
        onClick={handleCreateShowoff}
        className="fixed right-6 bottom-24 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <PlusIcon className="w-7 h-7" />
      </motion.button>
    </div>
  );
};

export default ShowoffPage;
