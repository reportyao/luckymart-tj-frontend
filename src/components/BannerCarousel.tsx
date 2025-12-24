import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  link_type: string;
}

const BannerCarousel: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const now = new Date().toISOString();
        // 使用类型断言，因为 banners 表还没有在 TypeScript 类型定义中
        const { data, error } = await (supabase as any)
          .from('banners')
          .select('id, title, image_url, link_url, link_type')
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

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

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
    <div className="relative h-40 overflow-hidden rounded-2xl">
      <img
        src={currentBanner.image_url}
        alt={currentBanner.title}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x320?text=Banner';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
      <div className="absolute bottom-4 left-4 right-4">
        <h3 className="text-white font-bold text-lg truncate">{currentBanner.title}</h3>
      </div>

      {/* 导航按钮 */}
      {banners.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goToPrevious();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center transition-colors"
          >
            <ChevronRightIcon className="w-5 h-5 text-white" />
          </button>
        </>
      )}

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
