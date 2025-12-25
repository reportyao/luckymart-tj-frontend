import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../contexts/UserContext';
import {
  ShoppingBag,
  Users,
  Clock,
  Share2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

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
}

interface GroupBuySession {
  id: string;
  session_code: string;
  current_participants: number;
  max_participants: number;
  expires_at: string;
  orders: Array<{
    id: string;
    user_id: string;
    created_at: string;
  }>;
}

// 图片轮播组件
function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
        <span className="text-gray-400">No Image</span>
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <img
        src={images[0]}
        alt={alt}
        className="w-full h-64 object-cover"
      />
    );
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative w-full h-64">
      {/* Main Image */}
      <img
        src={images[currentIndex]}
        alt={`${alt} - ${currentIndex + 1}`}
        className="w-full h-full object-cover"
      />
      
      {/* Navigation Arrows */}
      <button
        onClick={goToPrevious}
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={goToNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
      
      {/* Dots Indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex
                ? 'bg-white w-4'
                : 'bg-white/50 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
      
      {/* Image Counter */}
      <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
}

export default function GroupBuyDetailPage() {
  const { productId: id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, wallets } = useUser();
  const [product, setProduct] = useState<GroupBuyProduct | null>(null);
  const [sessions, setSessions] = useState<GroupBuySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

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

      // Fetch active sessions
      const { data: sessionsData, error: sessionsError } = await supabase.functions.invoke(
        'group-buy-list',
        {
          body: { type: 'sessions', product_id: id },
        }
      );

      if (sessionsError) throw sessionsError;
      if (sessionsData?.success) {
        setSessions(sessionsData.data);
      }
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

    // Check balance from wallets - use BALANCE type wallet
    const mainWallet = wallets.find((w) => w.type === 'BALANCE' || w.currency === 'TJS');
    const balance = mainWallet?.balance || 0;
    if (balance < product.price_per_person) {
      alert(t('groupBuy.insufficientBalance'));
      return;
    }

    try {
      setJoining(true);

      // Use user.id (UUID) instead of telegram_id for the API call
      const { data, error } = await supabase.functions.invoke('group-buy-join', {
        body: {
          product_id: product.id,
          session_id: sessionId || null,
          user_id: user.id, // Use UUID
        },
      });

      if (error) throw error;

      if (data?.success) {
        alert(t('groupBuy.joinSuccess'));
        navigate('/my-group-buys');
      } else {
        alert(data?.error || t('groupBuy.joinFailed'));
      }
    } catch (error: any) {
      console.error('Failed to join group:', error);
      alert(error.message || t('groupBuy.joinFailed'));
    } finally {
      setJoining(false);
    }
  };

  const handleShare = (sessionId: string) => {
    const shareUrl = `${window.location.origin}/group-buy/${product?.id}?session=${sessionId}`;
    if (navigator.share) {
      navigator.share({
        title: getLocalizedText(product?.title),
        text: t('groupBuy.shareText'),
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert(t('common.linkCopied'));
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{t('groupBuy.productNotFound')}</p>
          <button
            onClick={() => navigate('/group-buy')}
            className="mt-4 text-orange-500 hover:text-orange-600"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white hover:text-orange-100"
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
        <p className="text-gray-600 mb-4">{getLocalizedText(product.description)}</p>

        {/* Price */}
        <div className="bg-orange-50 rounded-2xl p-4 mb-6">
          <div className="flex items-end gap-2 mb-2">
            <div className="text-orange-600 font-bold text-3xl">
              ₽{product.price_per_person}
            </div>
            <div className="text-gray-400 line-through text-lg mb-1">
              ₽{product.original_price}
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

        {/* Active Sessions */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            {sessions.length > 0 ? t('groupBuy.joinExisting') : t('groupBuy.noActiveGroups')}
          </h2>

          {sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white border-2 border-orange-200 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-orange-500" />
                      <span className="font-bold text-gray-800">
                        {session.current_participants}/{session.max_participants}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      {calculateTimeLeft(session.expires_at)}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleJoinGroup(session.id)}
                      disabled={joining}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 rounded-lg font-bold hover:from-orange-600 hover:to-red-600 transition-colors disabled:opacity-50"
                    >
                      {joining ? t('common.processing') : t('groupBuy.joinNow')}
                    </button>
                    <button
                      onClick={() => handleShare(session.id)}
                      className="px-4 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
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
          disabled={joining}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-red-600 transition-colors disabled:opacity-50"
        >
          {joining ? t('common.processing') : t('groupBuy.startNewGroup')}
        </button>

        {/* Rules */}
        <div className="mt-6 p-4 bg-blue-50 rounded-xl">
          <h3 className="font-bold text-gray-800 mb-2">{t('groupBuy.rules.title')}</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• {t('groupBuy.rules.rule1')}</li>
            <li>• {t('groupBuy.rules.rule2')}</li>
            <li>• {t('groupBuy.rules.rule3')}</li>
            <li>• {t('groupBuy.rules.rule4')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
