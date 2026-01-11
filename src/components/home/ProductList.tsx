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
  emptyText = '暂无商品',
  linkPrefix,
}) => {
  const { t, i18n } = useTranslation();

  // 获取商品标题
  const getProductTitle = (product: Product) => {
    const localizedName = getLocalizedText(product.name_i18n as Record<string, string> | null, i18n.language);
    const localizedTitle = getLocalizedText(product.title_i18n as Record<string, string> | null, i18n.language);
    return localizedName || localizedTitle || product.title || '';
  };

  // 计算进度百分比
  const getProgress = (product: Product) => {
    if (product.type === 'lottery') {
      const soldTickets = product.sold_tickets || 0;
      const totalTickets = product.total_tickets || 1;
      return (soldTickets / totalTickets) * 100;
    }
    return 0;
  };

  return (
    <div className="mt-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 px-4">{title}</h3>
      
      {isLoading ? (
        <div className="px-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-3 animate-pulse flex space-x-3">
              <div className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="h-5 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="px-4 space-y-3">
          {products.map((product) => (
            <Link
              key={product.id}
              to={`${linkPrefix}/${product.id}`}
              className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex space-x-3 hover:shadow-md transition-shadow"
            >
              {/* 商品图片 */}
              <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                {product.image_url ? (
                  <LazyImage
                    src={product.image_url}
                    alt={getProductTitle(product)}
                    className="w-full h-full object-cover"
                    width={96}
                    height={96}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-xs">No Image</span>
                  </div>
                )}
              </div>

              {/* 商品信息 */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1">
                    {getProductTitle(product)}
                  </h4>
                  
                  {/* 积分商城特有信息 */}
                  {product.type === 'lottery' && (
                    <div className="flex items-center text-xs text-gray-500 space-x-2">
                      <span className="flex items-center">
                        <UserGroupIcon className="w-3 h-3 mr-1" />
                        {product.sold_tickets}/{product.total_tickets}
                      </span>
                      <span className="text-xs text-gray-400">
                        {getProgress(product).toFixed(0)}%
                      </span>
                    </div>
                  )}

                  {/* 拼团特有信息 */}
                  {product.type === 'groupbuy' && (
                    <div className="flex items-center text-xs text-gray-500 space-x-2">
                      <span className="flex items-center">
                        <UserGroupIcon className="w-3 h-3 mr-1" />
                        {product.group_size}{t('groupBuy.people')}
                      </span>
                      {product.active_sessions_count && product.active_sessions_count > 0 && (
                        <span className="bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded text-xs">
                          {product.active_sessions_count} {t('groupBuy.activeGroups')}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 价格 */}
                <div className="flex items-end justify-between">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-lg font-bold text-red-500">
                      {formatCurrency('TJS', product.price)}
                    </span>
                    {product.type === 'groupbuy' && product.original_price > product.price && (
                      <span className="text-xs text-gray-400 line-through">
                        {formatCurrency('TJS', product.original_price)}
                      </span>
                    )}
                  </div>
                  
                  {/* 状态标签 */}
                  {product.type === 'lottery' && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      product.status === 'ACTIVE' 
                        ? 'bg-green-100 text-green-600' 
                        : product.status === 'SOLD_OUT'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {product.status === 'ACTIVE' ? t('lottery.active') : 
                       product.status === 'SOLD_OUT' ? t('lottery.soldOut') : 
                       t('lottery.upcoming')}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="px-4">
          <div className="bg-white rounded-xl p-8 text-center text-gray-400">
            {emptyText}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
