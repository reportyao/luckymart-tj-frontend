import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';


interface Banner {
  id: string;
  title: string;
  image_url: string;
  image_url_zh: string | null;
  image_url_ru: string | null;
  image_url_tg: string | null;
  link_url: string | null;
  link_type: string;
}

const BannerCarousel: React.FC = () => {
  const { i18n } = useTranslation();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const now = new Date().toISOString();
        const { data, error } = await (supabase as any)
          .from('banners')
          .select('id, title, image_url, image_url_zh, image_url_ru, image_url_tg, link_url, link_type')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setBanners(data || []);
      } catch (error) {
        console.error('Failed to fetch banners:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBanners();
  }, []);

  // 自动轮播
  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [banners.length]);

  // 根据当前语言获取对应的Banner图片
  const getLocalizedImageUrl = useCallback((banner: Banner): string => {
    const lang = i18n.language;
    
    // 根据语言选择对应的图片
    if (lang === 'zh' && banner.image_url_zh) {
      return banner.image_url_zh;
    }
    if (lang === 'ru' && banner.image_url_ru) {
      return banner.image_url_ru;
    }
    if (lang === 'tg' && banner.image_url_tg) {
      return banner.image_url_tg;
    }
    
    // Fallback: 按优先级尝试其他语言版本
    // 优先使用中文版作为默认
    if (banner.image_url_zh) return banner.image_url_zh;
    if (banner.image_url_ru) return banner.image_url_ru;
    if (banner.image_url_tg) return banner.image_url_tg;
    
    // 最后使用原始image_url
    return banner.image_url;
  }, [i18n.language]);

  if (isLoading) {
    return (
      <div className="relative h-40 bg-gray-200 rounded-2xl animate-pulse"></div>
    );
  }

  if (banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];
  const currentImageUrl = getLocalizedImageUrl(currentBanner);

  const BannerContent = () => (
    <div className="relative h-40 overflow-hidden rounded-2xl">
      <img
        src={currentImageUrl}
        alt={currentBanner.title}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x320?text=Banner';
        }}
      />


      {/* 指示器 */}
      {banners.length > 1 && (
        <div className="absolute bottom-2 right-4 flex space-x-1">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentIndex(index);
              }}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );

  // 根据链接类型决定如何渲染
  if (currentBanner.link_url) {
    if (currentBanner.link_type === 'internal') {
      return (
        <Link to={currentBanner.link_url} className="block">
          <BannerContent />
        </Link>
      );
    } else {
      return (
        <a href={currentBanner.link_url} target="_blank" rel="noopener noreferrer" className="block">
          <BannerContent />
        </a>
      );
    }
  }

  return <BannerContent />;
};

export default BannerCarousel;
