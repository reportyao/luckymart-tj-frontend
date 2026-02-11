import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

// 缓存 banner 数据，避免每次组件挂载都重新请求
let cachedBanners: Banner[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

const BannerCarousel: React.FC = () => {
  const { i18n } = useTranslation();
  const [banners, setBanners] = useState<Banner[]>(cachedBanners || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(!cachedBanners);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const preloadedRef = useRef<boolean>(false);
  const loadedCountRef = useRef<number>(0);

  // 根据当前语言获取对应的图片URL
  const getLocalizedImageUrl = useCallback((banner: Banner): string => {
    const lang = i18n.language;
    
    // 根据语言选择对应的图片URL
    if (lang === 'zh' && banner.image_url_zh) {
      return banner.image_url_zh;
    }
    if (lang === 'ru' && banner.image_url_ru) {
      return banner.image_url_ru;
    }
    if (lang === 'tg' && banner.image_url_tg) {
      return banner.image_url_tg;
    }
    
    // 如果当前语言没有对应图片，按优先级回退
    // 优先级：当前语言 > 中文 > 俄语 > 塔吉克语 > 默认图片
    if (banner.image_url_zh) return banner.image_url_zh;
    if (banner.image_url_ru) return banner.image_url_ru;
    if (banner.image_url_tg) return banner.image_url_tg;
    
    // 最后使用默认的image_url
    return banner.image_url;
  }, [i18n.language]);

  // 预加载所有图片
  const preloadImages = useCallback((bannerList: Banner[]) => {
    if (preloadedRef.current || bannerList.length === 0) return;
    preloadedRef.current = true;
    loadedCountRef.current = 0;
    
    const totalImages = bannerList.length;
    
    bannerList.forEach((banner) => {
      const img = new Image();
      img.onload = () => {
        loadedCountRef.current += 1;
        if (loadedCountRef.current >= totalImages) {
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        loadedCountRef.current += 1;
        if (loadedCountRef.current >= totalImages) {
          setImagesLoaded(true);
        }
      };
      // 预加载当前语言对应的图片
      img.src = getLocalizedImageUrl(banner);
    });
    
    // 超时后强制显示
    setTimeout(() => {
      setImagesLoaded(true);
    }, 3000);
  }, [getLocalizedImageUrl]);

  // 当语言变化时，重新预加载图片
  useEffect(() => {
    if (banners.length > 0) {
      preloadedRef.current = false;
      loadedCountRef.current = 0;
      setImagesLoaded(false);
      preloadImages(banners);
    }
  }, [i18n.language, banners, preloadImages]);

  useEffect(() => {
    const fetchBanners = async () => {
      // 检查缓存是否有效
      const now = Date.now();
      if (cachedBanners && (now - cacheTimestamp) < CACHE_DURATION) {
        setBanners(cachedBanners);
        setIsLoading(false);
        preloadImages(cachedBanners);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from('banners')
          .select('id, title, image_url, image_url_zh, image_url_ru, image_url_tg, link_url, link_type')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        
        const bannerData = data || [];
        cachedBanners = bannerData;
        cacheTimestamp = now;
        setBanners(bannerData);
        preloadImages(bannerData);
      } catch (error) {
        console.error('Failed to fetch banners:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBanners();
  }, [preloadImages]);

  // 自动轮播
  useEffect(() => {
    if (banners.length <= 1 || !imagesLoaded) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [banners.length, imagesLoaded]);

  if (isLoading) {
    return (
      <div className="relative h-40 bg-gray-200 rounded-2xl animate-pulse"></div>
    );
  }

  if (banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];

  const BannerContent = () => (
    <div className="relative h-40 overflow-hidden rounded-2xl bg-gray-100">
      {/* 渲染所有图片，通过 opacity 和 transform 控制平滑过渡 */}
      {banners.map((banner, index) => {
        const isActive = index === currentIndex;
        const imageUrl = getLocalizedImageUrl(banner);
        return (
          <div
            key={`${banner.id}-${i18n.language}`}
            className="absolute inset-0 w-full h-full"
            style={{
              opacity: isActive ? 1 : 0,
              transform: isActive ? 'scale(1)' : 'scale(1.02)',
              transition: 'opacity 700ms ease-in-out, transform 700ms ease-in-out',
              zIndex: isActive ? 1 : 0,
            }}
          >
            <img
              src={imageUrl}
              alt={banner.title}
              className="w-full h-full object-contain"
              style={{
                opacity: imagesLoaded ? 1 : 0,
                transition: 'opacity 300ms ease-in-out',
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="320"%3E%3Crect fill="%23f0f0f0" width="800" height="320"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="24"%3EBanner%3C/text%3E%3C/svg%3E';
              }}
            />
          </div>
        );
      })}

      {/* 指示器 */}
      {banners.length > 1 && (
        <div className="absolute bottom-2 right-4 flex space-x-1.5 z-10">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentIndex(index);
              }}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor: index === currentIndex ? 'white' : 'rgba(255,255,255,0.5)',
                transform: index === currentIndex ? 'scale(1.2)' : 'scale(1)',
              }}
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
