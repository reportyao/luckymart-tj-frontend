import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { ShoppingBag, Users, Clock, ChevronRight } from 'lucide-react';

interface GroupBuyProduct {
  id: string;
  title: { zh: string; ru: string; tg: string };
  description: { zh: string; ru: string; tg: string };
  image_url: string;
  original_price: number;
  price_per_person: number;
  group_size: number; // 数据库字段名
  timeout_hours: number;
  active_sessions_count: number;
  active_sessions: Array<{
    id: string;
    current_participants: number;
    group_size: number; // 数据库字段名
    expires_at: string;
  }>;
}

export default function GroupBuyListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<GroupBuyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('group-buy-list', {
        body: { type: 'products' },
      });

      if (error) throw error;
      if (data?.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocalizedText = (text: any) => {
    if (!text) return '';
    return text[i18n.language] || text.zh || '';
  };

  const calculateDiscount = (original: number, perPerson: number) => {
    return Math.round(((original - perPerson) / original) * 100);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-b-3xl shadow-lg">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="w-7 h-7" />
          {t('groupBuy.title')}
        </h1>
        <p className="text-orange-100 mt-2">{t('groupBuy.subtitle')}</p>
      </div>

      {/* Products Grid */}
      <div className="p-4 space-y-4 mt-4">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('groupBuy.noProducts')}</p>
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              onClick={() => navigate(`/group-buy/${product.id}`)}
              className="bg-white rounded-2xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            >
              {/* Product Image */}
              <div className="relative">
                <img
                  src={product.image_url}
                  alt={getLocalizedText(product.title)}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                  {calculateDiscount(product.original_price, product.price_per_person)}% OFF
                </div>
                {product.active_sessions_count > 0 && (
                  <div className="absolute top-3 right-3 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {product.active_sessions_count}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4">
                <h3 className="font-bold text-lg text-gray-800 mb-2">
                  {getLocalizedText(product.title)}
                </h3>
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {getLocalizedText(product.description)}
                </p>

                {/* Price Info */}
                <div className="flex items-end gap-2 mb-3">
                  <div className="text-orange-600 font-bold text-2xl">
                    ₽{product.price_per_person}
                  </div>
                  <div className="text-gray-400 line-through text-sm mb-1">
                    ₽{product.original_price}
                  </div>
                </div>

                {/* Group Info */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{product.group_size}{t('groupBuy.people')}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{product.timeout_hours}{t('groupBuy.hours')}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>

                {/* Active Sessions Preview */}
                {product.active_sessions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-2">
                      {t('groupBuy.activeGroups')}:
                    </div>
                    <div className="flex gap-2 overflow-x-auto">
                      {product.active_sessions.slice(0, 3).map((session) => (
                        <div
                          key={session.id}
                          className="flex-shrink-0 bg-orange-50 rounded-lg px-3 py-2 text-xs"
                        >
                          <div className="font-medium text-orange-600">
                            {session.current_participants}/{session.group_size}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <button className="w-full mt-4 bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-xl font-bold hover:from-orange-600 hover:to-red-600 transition-colors">
                  {product.active_sessions_count > 0
                    ? t('groupBuy.joinGroup')
                    : t('groupBuy.startGroup')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
