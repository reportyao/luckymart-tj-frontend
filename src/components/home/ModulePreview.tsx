import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { LazyImage } from '../LazyImage';
import { formatCurrency, getLocalizedText } from '../../lib/utils';

interface ProductPreviewItem {
  id: string;
  image_url: string | null;
  price: number;
  title?: string;
  title_i18n?: Record<string, string> | null;
  name_i18n?: Record<string, string> | null;
}

interface ModulePreviewProps {
  title: string;
  description: string;
  linkTo: string;
  linkText: string;
  products: ProductPreviewItem[];
  isLoading?: boolean;
  gradientFrom: string;
  gradientTo: string;
  iconBgFrom: string;
  iconBgTo: string;
  icon: React.ReactNode;
}

/**
 * 首页模块预览组件
 * 左边显示模块名称和描述，右边显示最新4条商品缩略图和价格
 */
export const ModulePreview: React.FC<ModulePreviewProps> = ({
  title,
  description,
  linkTo,
  linkText,
  products,
  isLoading = false,
  gradientFrom,
  gradientTo,
  iconBgFrom,
  iconBgTo,
  icon,
}) => {
  const { t, i18n } = useTranslation();

  // 获取商品标题
  const getProductTitle = (product: ProductPreviewItem) => {
    const localizedName = getLocalizedText(product.name_i18n as Record<string, string> | null, i18n.language);
    const localizedTitle = getLocalizedText(product.title_i18n as Record<string, string> | null, i18n.language);
    return localizedName || localizedTitle || product.title || '';
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
      {/* 上半部分：模块信息 */}
      <div className={`bg-gradient-to-r ${gradientFrom} ${gradientTo} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 bg-gradient-to-br ${iconBgFrom} ${iconBgTo} rounded-full flex items-center justify-center shadow-md`}>
              {icon}
            </div>
            <div>
              <h3 className="text-white font-bold text-base">{title}</h3>
              <p className="text-white/80 text-xs mt-0.5">{description}</p>
            </div>
          </div>
          <Link
            to={linkTo}
            className="flex items-center text-white/90 text-sm font-medium hover:text-white transition-colors"
          >
            {linkText}
            <ArrowRightIcon className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>

      {/* 下半部分：商品预览 */}
      <div className="p-3">
        {isLoading ? (
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-lg mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {products.slice(0, 4).map((product) => (
              <Link
                key={product.id}
                to={`${linkTo}/${product.id}`}
                className="group"
              >
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-1 relative">
                  {product.image_url ? (
                    <LazyImage
                      src={product.image_url}
                      alt={getProductTitle(product)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      width={80}
                      height={80}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-xs">No Image</span>
                    </div>
                  )}
                </div>
                <p className="text-xs font-semibold text-red-500 text-center">
                  {formatCurrency('TJS', product.price)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-400 text-sm">
            {t('common.noProducts')}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModulePreview;
