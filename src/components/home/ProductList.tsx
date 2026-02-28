import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LazyImage } from '../LazyImage';
import { formatCurrency, getLocalizedText } from '../../lib/utils';
import { UserGroupIcon, ClockIcon } from '@heroicons/react/24/outline';

interface BaseProduct {
  id: string;
  image_url: string | null;
  price: number;
  title?: string;
  title_i18n?: Record<string, string> | null;
  name_i18n?: Record<string, string> | null;
  created_at: string;
}

interface LotteryProduct extends BaseProduct {
  type: 'lottery';
  sold_tickets: number;
  total_tickets: number;
  status: string;
}

interface GroupBuyProduct extends BaseProduct {
  type: 'groupbuy';
  group_size: number;
  original_price: number;
  active_sessions_count?: number;
}

type Product = LotteryProduct | GroupBuyProduct;

interface ProductListProps {
  title: string;
  products: Product[];
  isLoading?: boolean;
  emptyText?: string;
  linkPrefix: string;
}

/**
 * 首页商品列表组件
 * 完整展示商品列表，按新到旧排序
 */
export const ProductList: React.FC<ProductListProps> = ({
  title,
  products,
  isLoading = false,
  emptyText,
  linkPrefix,
}) => {
  const { i18n, t } = useTranslation();

  const getProductTitle = (product: Product) => {
    const localizedName = getLocalizedText(product.name_i18n as Record<string, string> | null, i18n.language);
    const localizedTitle = getLocalizedText(product.title_i18n as Record<string, string> | null, i18n.language);
    return localizedName || localizedTitle || product.title || '';
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-800 px-1">{title}</h2>
      
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex space-x-3 animate-pulse">
              <div className="w-24 h-24 flex-shrink-0 rounded-lg bg-gray-200"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="space-y-3">
          {products.map((product) => (
            <Link
              key={product.id}
              to={`${linkPrefix}/${product.id}`}
              className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex space-x-3 hover:shadow-md transition-shadow"
            >
              {/* 商品图片 - 使用内联样式确保兼容性 */}
              <div
                style={{
                  width: '96px',
                  height: '96px',
                  flexShrink: 0,
                  borderRadius: '0.5rem',
                  overflow: 'hidden',
                  backgroundColor: '#f3f4f6',
                  position: 'relative',
                }}
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={getProductTitle(product)}
                    loading="lazy"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96"%3E%3Crect fill="%23f0f0f0" width="96" height="96"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="12"%3ENo Image%3C/text%3E%3C/svg%3E';
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9ca3af',
                      backgroundColor: '#f3f4f6',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem' }}>No Image</span>
                  </div>
                )}
              </div>

              {/* 商品信息 */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-800 line-clamp-2 mb-1">
                  {getProductTitle(product)}
                </h3>
                <p className="text-lg font-bold text-red-500">
                  {formatCurrency('TJS', product.price)}
                </p>
                {product.type === 'lottery' && (
                  <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center">
                      <UserGroupIcon className="w-3.5 h-3.5 mr-1" />
                      {product.sold_tickets}/{product.total_tickets}
                    </span>
                  </div>
                )}
                {product.type === 'groupbuy' && (
                  <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center">
                      <UserGroupIcon className="w-3.5 h-3.5 mr-1" />
                      {product.group_size}{t('common.people', '人')}
                    </span>
                    {product.active_sessions_count !== undefined && product.active_sessions_count > 0 && (
                      <span className="flex items-center">
                        <ClockIcon className="w-3.5 h-3.5 mr-1" />
                        {product.active_sessions_count}{t('groupBuy.activeGroups', '个进行中')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          {emptyText || t('common.noData', '暂无数据')}
        </div>
      )}
    </div>
  );
};

export default ProductList;
