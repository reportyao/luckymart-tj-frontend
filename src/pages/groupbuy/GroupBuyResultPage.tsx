import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../contexts/UserContext';
import {
  Trophy,
  Users,
  Clock,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface GroupBuyResult {
  id: string;
  session_id: string;
  winner_id: string;
  winner_username: string | null;
  created_at: string;
  timestamp_sum: number;
  winning_index: number;
  session: {
    id: string;
    session_code: string;
    product_id: string;
    current_participants: number;
    max_participants: number;
  };
  product: {
    id: string;
    title: { zh: string; ru: string; tg: string };
    image_url: string;
    original_price: number;
    price_per_person: number;
  };
  participants: Array<{
    user_id: string;
    username: string;
    order_number: string;
    created_at: string;
  }>;
}

export default function GroupBuyResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const [result, setResult] = useState<GroupBuyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWinner, setIsWinner] = useState(false);

  useEffect(() => {
    if (sessionId) {
      fetchResult();
    }
  }, [sessionId]);

  useEffect(() => {
    if (result && user && result.winner_id === user.telegram_id.toString()) {
      setIsWinner(true);
      // Trigger confetti animation
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [result, user]);

  const fetchResult = async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('group-buy-list', {
        body: { type: 'session-result', session_id: sessionId },
      });

      if (error) throw error;
      if (data?.success) {
        setResult(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch result:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocalizedText = (text: any) => {
    if (!text) return '';
    return text[i18n.language] || text.zh || '';
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

  if (!result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">{t('groupBuy.noResult')}</p>
          <button
            onClick={() => navigate('/group-buy')}
            className="mt-4 text-orange-500 hover:text-orange-600 font-medium"
          >
            {t('groupBuy.browseProducts')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-b-3xl shadow-lg">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white hover:text-orange-100 mb-4"
        >
          <ChevronLeft className="w-6 h-6" />
          {t('common.back')}
        </button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-7 h-7" />
          {t('groupBuy.drawResult')}
        </h1>
      </div>

      {/* Winner Announcement */}
      <div className="p-4">
        {isWinner ? (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-3xl p-8 text-center shadow-xl">
            <Sparkles className="w-16 h-16 text-white mx-auto mb-4 animate-pulse" />
            <h2 className="text-3xl font-bold text-white mb-2">
              {t('groupBuy.congratulations')}
            </h2>
            <p className="text-white text-lg">{t('groupBuy.youWon')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 text-center shadow-lg">
            <Trophy className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {t('groupBuy.drawCompleted')}
            </h2>
            <p className="text-gray-600">{t('groupBuy.betterLuckNextTime')}</p>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <img
            src={result.product.image_url}
            alt={getLocalizedText(result.product.title)}
            className="w-full h-48 object-cover"
          />
          <div className="p-4">
            <h3 className="font-bold text-lg text-gray-800 mb-2">
              {getLocalizedText(result.product.title)}
            </h3>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{t('groupBuy.pricePerPerson')}</span>
              <span className="text-orange-600 font-bold">
                ₽{result.product.price_per_person}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Winner Info */}
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            {t('groupBuy.winner')}
          </h3>
          <div className="flex items-center gap-4 bg-yellow-50 rounded-xl p-4">
            <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-800">{result.winner_username}</p>
                <p className="text-sm text-gray-600">
                  {t('groupBuy.drawTime')}: {new Date(result.created_at).toLocaleString()}
                </p>
            </div>
          </div>
        </div>
      </div>

      {/* All Participants */}
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            {t('groupBuy.allParticipants')}
          </h3>
          <div className="space-y-3">
            {result.participants.map((participant, index) => (
              <div
                key={participant.order_number}
                className={`flex items-center gap-4 p-3 rounded-xl ${
                  participant.user_id === result.winner_id
                    ? 'bg-yellow-50 border-2 border-yellow-400'
                    : 'bg-gray-50'
                }`}
              >
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="font-bold text-orange-600">{index + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{participant.username}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(participant.created_at).toLocaleString()}
                  </p>
                </div>
                {participant.user_id === result.winner_id && (
                  <CheckCircle className="w-6 h-6 text-yellow-500" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Verification Data */}
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            {t('groupBuy.verificationTitle')}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('groupBuy.timestampSum')}:</span>
              <span className="font-mono text-gray-800">{result.timestamp_sum}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('groupBuy.verificationFormula')}:</span>
              <span className="font-mono text-gray-800">
                {result.timestamp_sum} % {result.session.max_participants} = {result.winning_index}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 space-y-3">
        <button
          onClick={() => navigate('/group-buy')}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-shadow"
        >
          {t('groupBuy.browseProducts')}
        </button>
        <button
          onClick={() => navigate('/my-group-buys')}
          className="w-full bg-white text-orange-500 py-4 rounded-2xl font-bold shadow-md hover:shadow-lg transition-shadow"
        >
          {t('groupBuy.myGroups')}
        </button>
      </div>
    </div>
  );
}
