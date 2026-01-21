import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../contexts/UserContext';
import toast from 'react-hot-toast';
import {
  ShoppingBag,
  Users,
  Clock,
  Share2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

interface PriceComparisonItem {
  platform: string;
  price: number;
}

interface GroupBuyProduct {
  id: string;
  title: { zh: string; ru: string; tg: string };
  description: { zh: string; ru: string; tg: string };
  image_url: string;
  images?: string[]; // 多图支持
  original_price: number;
  price_per_person: number;
  group_size: number;
  timeout_hours: number;
  product_type: string;
  price_comparisons?: PriceComparisonItem[];
}

interface GroupBuySession {
  id: string;
  session_code: string;
  current_participants: number;
  max_participants: number;
  expires_at: string;
  initiator_id: string;
  orders: Array<{
    id: string;
    user_id: string;
    created_at: string;
    users?: {
      id: string;
      telegram_id: string;
      telegram_username: string | null;
      avatar_url: string | null;
    };
  }>;
}

// 图片轮播组件
function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  // 自动播放
  useEffect(() => {
    if (!images || images.length <= 1 || !autoPlayEnabled) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    }, 3000); // 每3秒切换

    return () => clearInterval(timer);
  }, [images, images.length, autoPlayEnabled, currentIndex]);

  if (!images || images.length === 0) {
    return (
      <div className="w-full bg-gray-200 flex items-center justify-center" style={{ height: '375px' }}>
        <span className="text-gray-400">No Image</span>
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <>
        <div 
          className="w-full bg-gray-50 flex items-center justify-center cursor-pointer"
          style={{ height: '375px' }}
          onClick={() => setIsModalOpen(true)}
        >
          <img
            src={images[0]}
            alt={alt}
            className="w-full h-full object-contain"
          />
        </div>
        {/* Image Modal */}
        {isModalOpen && (
          <div 
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            onClick={() => setIsModalOpen(false)}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={images[0]}
              alt={alt}
              className="max-w-full max-h-full object-contain p-4 cursor-pointer"
              onClick={() => setIsModalOpen(false)}
            />
          </div>
        )}
      </>
    );
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setAutoPlayEnabled(false);
    setTimeout(() => setAutoPlayEnabled(true), 5000);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setAutoPlayEnabled(false);
    setTimeout(() => setAutoPlayEnabled(true), 5000);
  };

  return (
    <>
      <div className="relative w-full bg-gray-50" style={{ height: '375px' }}>
        {/* Main Image */}
        <div 
          className="w-full h-full flex items-center justify-center cursor-pointer"
          onClick={() => setIsModalOpen(true)}
        >
          <img
            src={images[currentIndex]}
            alt={`${alt} - ${currentIndex + 1}`}
            className="w-full h-full object-contain"
          />
        </div>
        
        {/* Navigation Arrows */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors z-10"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors z-10"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        
        {/* Dots Indicator */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
                setAutoPlayEnabled(false);
                setTimeout(() => setAutoPlayEnabled(true), 5000);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex ? 'bg-white w-4' : 'bg-white/60'
              }`}
            />
          ))}
        </div>
        
        {/* Image Counter */}
        <div className="absolute top-3 right-3 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
          {currentIndex + 1}/{images.length}
        </div>
      </div>

      {/* Image Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setIsModalOpen(false)}
        >
          <button
            onClick={() => setIsModalOpen(false)}
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <img
              src={images[currentIndex]}
              alt={`${alt} - ${currentIndex + 1}`}
              className="w-full h-full object-contain cursor-pointer"
              onClick={() => setIsModalOpen(false)}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 text-white p-3 rounded-full hover:bg-white/30 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 text-white p-3 rounded-full hover:bg-white/30 transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
              {currentIndex + 1} / {images.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 比价清单组件
function PriceComparisonList({ comparisons, t }: { comparisons: PriceComparisonItem[]; t: any }) {
  if (!comparisons || comparisons.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-100 rounded-xl p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        {t('groupBuy.priceComparison')}
      </h3>
      <div className="space-y-1">
        {comparisons.map((item, index) => (
          <div key={index} className="flex items-center text-sm">
            <X className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />
            <span className="text-gray-600">{item.platform}:</span>
            <span className="ml-2 text-gray-500">TJS {(item.price || 0).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GroupBuyDetailPage() {
  const { productId: id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, wallets, refreshWallets } = useUser();
  const [product, setProduct] = useState<GroupBuyProduct | null>(null);
  const [sessions, setSessions] = useState<GroupBuySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null); // 修改：记录正在处理的session
  const [userParticipatedSessions, setUserParticipatedSessions] = useState<Set<string>>(new Set()); // 新增：记录用户已参与的session
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (id) {
      fetchProductAndSessions();
    }
  }, [id]);

  const fetchProductAndSessions = async () => {
    try {
      setLoading(true);

      // Fetch product using Edge Function
      const { data: productResponse, error: productError } = await supabase.functions.invoke(
        'group-buy-list',
        {
          body: { type: 'product', product_id: id },
        }
      );

      if (productError) throw productError;
      if (productResponse?.success) {
        setProduct(productResponse.data);
      }

      // Fetch active sessions using Edge Function
      const { data: sessionsResponse, error: sessionsError } = await supabase.functions.invoke(
        'group-buy-list',
        {
          body: { type: 'sessions', product_id: id },
        }
      );

      if (sessionsError) throw sessionsError;
      
      const sessionsData = sessionsResponse?.success ? sessionsResponse.data : [];
      
      // 检查用户已参与的session
      // 注意：订单中的user_id可能是telegram_id或UUID，需要同时匹配
      if (user && sessionsData && Array.isArray(sessionsData)) {
        const participatedSet = new Set<string>();
        sessionsData.forEach((session: any) => {
          if (session.orders?.some((order: any) => 
            order.user_id === user.telegram_id || 
            order.user_id === user.id ||
            order.users?.telegram_id === user.telegram_id ||
            order.users?.id === user.id
          )) {
            participatedSet.add(session.id);
          }
        });
        setUserParticipatedSessions(participatedSet);
      }
      
      setSessions(sessionsData || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (sessionId?: string) => {
    if (!user) {
      alert(t('common.pleaseLogin'));
      return;
    }

    if (!product) return;

    // Check balance from wallets - use TJS type wallet
    console.log('[GroupBuy] Checking balance, wallets:', wallets);
    const mainWallet = wallets.find((w) => w.type === 'TJS' && w.currency === 'TJS');
    console.log('[GroupBuy] Main wallet:', mainWallet);
    const balance = Number(mainWallet?.balance || 0);
    const pricePerPerson = Number(product.price_per_person);
    console.log('[GroupBuy] Balance:', balance, 'Price:', pricePerPerson);
    
    if (!mainWallet) {
      // 如果没有找到钱包，尝试刷新钱包数据
      console.log('[GroupBuy] Wallet not found, trying to refresh...');
      alert(t('groupBuy.walletNotFound') || '钱包数据加载中，请稍后重试');
      return;
    }
    
    if (balance < pricePerPerson) {
      console.log('[GroupBuy] Insufficient balance:', balance, '<', pricePerPerson);
      alert(t('groupBuy.insufficientBalance'));
      return;
    }

    try {
      setJoiningSessionId(sessionId || 'new'); // 修改：设置正在处理的session

      // 修复：传递session_code而不是session_id
      let requestBody: any = {
        product_id: product.id,
        user_id: user.id, // Use UUID
      };

      if (sessionId) {
        // 查找session_code
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
          requestBody.session_code = session.session_code;
        }
      }

      const { data, error } = await supabase.functions.invoke('group-buy-join', {
        body: requestBody,
      });

      if (error) throw error;

      if (data?.success) {
        alert(t('groupBuy.joinSuccess'));
        // 刷新当前页面数据，不跳转
        await fetchProductAndSessions();
        // 刷新钱包余额
        if (refreshWallets) {
          await refreshWallets();
        }
      } else {
        alert(data?.error || t('groupBuy.joinFailed'));
      }
    } catch (error: any) {
      console.error('Failed to join group:', error);
      alert(error.message || t('groupBuy.joinFailed'));
    } finally {
      setJoiningSessionId(null); // 修改：清除处理状态
    }
  };

  const handleShare = async (sessionCode: string) => {
    try {
      // 使用标准的带邀请码分享链接
      const referralCode = user?.referral_code || user?.invite_code;
      if (!referralCode) {
        toast.error(t('invite.noReferralCode') || '没有邀请码');
        return;
      }
      
      const sharePrefix = import.meta.env.VITE_TELEGRAM_SHARE_LINK || 't.me/tezbarakatbot/shoppp';
      const inviteLink = `https://${sharePrefix}?startapp=${referralCode}`;
      const shareText = `Барои Шумо тӯҳфа: Хариди мол бо нархи 3 маротиба арзонтар!\nМан худам санҷидам — кор мекунад! Ин шонсро аз даст надиҳед, ҳоло зер кунед`;
      
      // 优先使用 Telegram WebApp 的分享功能
      if (window.Telegram?.WebApp?.openTelegramLink) {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`;
        window.Telegram.WebApp.openTelegramLink(shareUrl);
        return;
      }
      
      // fallback 到浏览器原生分享
      if (navigator.share) {
        await navigator.share({
          title: getLocalizedText(product?.title),
          text: shareText,
          url: inviteLink,
        });
      } else {
        // 最后 fallback 到复制链接
        await navigator.clipboard.writeText(inviteLink);
        toast.success(t('common.linkCopied') || '链接已复制');
      }
    } catch (error) {
      console.error('Share error:', error);
      // 如果用户取消分享，不显示错误
      if (error instanceof Error && error.name !== 'AbortError') {
        toast.error(t('common.shareFailed') || '分享失败');
      }
    }
  };

  const getLocalizedText = (text: any) => {
    if (!text) return '';
    return text[i18n.language] || text.zh || '';
  };

  const calculateTimeLeft = (expiresAt: string) => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;

    if (diff <= 0) return t('groupBuy.expired');

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}${t('groupBuy.hours')} ${minutes}${t('groupBuy.minutes')}`;
  };

  // 获取商品图片数组
  const getProductImages = (): string[] => {
    if (!product) return [];
    
    // 优先使用images数组
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      return product.images;
    }
    
    // 回退到单张图片
    if (product.image_url) {
      return [product.image_url];
    }
    
    return [];
  };

  // 截断昵称显示
  const truncateUsername = (username: string | null, maxLength: number = 10): string => {
    if (!username) return 'User';
    if (username.length <= maxLength) return username;
    return username.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{t('groupBuy.productNotFound')}</p>
          <button
            onClick={() => navigate('/group-buy')}
            className="mt-4 text-purple-500 hover:text-purple-600"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white p-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white hover:text-pink-100"
        >
          <ChevronLeft className="w-6 h-6" />
          {t('common.back')}
        </button>
      </div>

      {/* Product Image Carousel */}
      <div className="relative">
        <ImageCarousel 
          images={getProductImages()} 
          alt={getLocalizedText(product.title)} 
        />
      </div>

      {/* Product Info */}
      <div className="p-6 bg-white rounded-t-3xl -mt-6 relative z-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {getLocalizedText(product.title)}
        </h1>
        {/* 商品介绍 - 智能分段 + 折叠展开 */}
        {getLocalizedText(product.description) && (
          <div className="space-y-2 mb-4">
            <div className={cn(
              "text-gray-600 leading-relaxed whitespace-pre-line",
              !isDescriptionExpanded && "line-clamp-3"
            )}>
              {/* 智能分段：将文本按句号分段 */}
              {getLocalizedText(product.description).split(/(?<=[.。!！?？])\s+/).map((paragraph: string, index: number) => (
                <p key={index} className="mb-2 last:mb-0">{paragraph.trim()}</p>
              ))}
            </div>
            {/* 展开/收起按钮 */}
            {getLocalizedText(product.description).length > 100 && (
              <button
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="text-blue-600 text-sm font-medium hover:text-blue-700 transition-colors flex items-center gap-1"
              >
                {isDescriptionExpanded ? (
                  <>
                    <span>{t('common.collapse')}</span>
                    <ChevronRightIcon className="w-4 h-4 transform rotate-90" />
                  </>
                ) : (
                  <>
                    <span>{t('common.expandMore')}</span>
                    <ChevronRightIcon className="w-4 h-4 transform -rotate-90" />
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Price */}
        <div className="bg-purple-50 rounded-2xl p-4 mb-4">
          <div className="flex items-end gap-2 mb-2">
            <div className="text-purple-600 font-bold text-3xl">
              TJS {product.price_per_person}
            </div>
            <div className="text-gray-400 line-through text-lg mb-1">
              TJS {product.original_price}
            </div>
            <div className="text-xs text-white bg-red-500 px-2 py-1 rounded-full mb-1">
              {t('groupBuy.groupPrice')}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>
                {product.group_size}
                {t('groupBuy.peopleGroup')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>
                {product.timeout_hours}
                {t('groupBuy.hoursLimit')}
              </span>
            </div>
          </div>
        </div>

        {/* Price Comparison List */}
        <PriceComparisonList 
          comparisons={product.price_comparisons || []} 
          t={t} 
        />

        {/* Active Sessions */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            {sessions.length > 0 ? t('groupBuy.joinExisting') : t('groupBuy.noActiveGroups')}
          </h2>

          {sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((session) => {
                const isParticipated = userParticipatedSessions.has(session.id);
                const isProcessing = joiningSessionId === session.id;
                
                return (
                  <div
                    key={session.id}
                    className="bg-white border-2 border-purple-200 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-500" />
                        <span className="font-bold text-gray-800">
                          {session.current_participants}/{session.max_participants}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        {calculateTimeLeft(session.expires_at)}
                      </div>
                    </div>

                    {/* 显示参与用户头像和剩余位置 - 虚席以待效果 */}
                    <div className="flex justify-center gap-4 mb-3">
                      {/* 已参与的用户 */}
                      {session.orders?.map((order: any) => (
                        <div key={order.id} className="flex flex-col items-center">
                          <img
                            src={order.users?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(order.users?.telegram_username || order.users?.first_name || 'U')}&background=random&size=48`}
                            alt={order.users?.telegram_username || order.users?.first_name || 'User'}
                            className="w-12 h-12 rounded-full border-2 border-purple-200 object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(order.users?.telegram_username || order.users?.first_name || 'U')}&background=random&size=48`;
                            }}
                          />
                          <span className="text-xs text-gray-600 mt-1 max-w-[60px] truncate text-center">
                            {order.users?.telegram_username || order.users?.first_name || `User ${order.user_id?.slice(-4) || ''}`}
                          </span>
                        </div>
                      ))}
                      {/* 剩余空位 - 虚席以待 */}
                      {Array.from({ length: session.max_participants - (session.orders?.length || 0) }).map((_, index) => (
                        <div key={`empty-${index}`} className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                            <span className="text-gray-400 text-lg">?</span>
                          </div>
                          <span className="text-xs text-gray-400 mt-1">
                            {t('groupBuy.waitingSlot')}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      {isParticipated ? (
                        <button
                          onClick={() => handleShare(session.session_code)}
                          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 rounded-lg font-bold hover:from-blue-600 hover:to-purple-600 transition-colors flex items-center justify-center gap-2"
                        >
                          <Share2 className="w-5 h-5" />
                          {t('groupBuy.share')}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleJoinGroup(session.id)}
                            disabled={isProcessing}
                            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 rounded-lg font-bold hover:from-purple-600 hover:to-pink-600 transition-colors disabled:opacity-50"
                          >
                            {isProcessing ? t('common.processing') : t('groupBuy.joinNow')}
                          </button>
                          <button
                            onClick={() => handleShare(session.session_code)}
                            className="px-4 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <Share2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">{t('groupBuy.beFirst')}</p>
            </div>
          )}
        </div>

        {/* Start New Group Button */}
        <button
          onClick={() => handleJoinGroup()}
          disabled={joiningSessionId === 'new'}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-bold text-lg hover:from-purple-600 hover:to-pink-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <ShoppingBag className="w-6 h-6" />
          {joiningSessionId === 'new' ? t('common.processing') : t('groupBuy.startNewGroup')}
        </button>
      </div>
    </div>
  );
}
