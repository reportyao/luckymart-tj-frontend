import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';

export type LogisticsStatusType = 
  | 'PENDING_SHIPMENT'      // 待发货
  | 'IN_TRANSIT_CHINA'      // 中国段运输中
  | 'IN_TRANSIT_TAJIKISTAN' // 塔国段运输中
  | 'READY_FOR_PICKUP'      // 待自提
  | 'PICKED_UP';            // 已提货

interface LogisticsStatusProps {
  status: LogisticsStatusType | string | null;
  chinaTrackingNo?: string | null;
  tajikistanTrackingNo?: string | null;
  estimatedArrivalDate?: string | null;
  pickupCode?: string | null;
  className?: string;
}

interface StatusStep {
  key: LogisticsStatusType;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

export const LogisticsStatus: React.FC<LogisticsStatusProps> = ({
  status,
  chinaTrackingNo,
  tajikistanTrackingNo,
  estimatedArrivalDate,
  pickupCode,
  className = '',
}) => {
  const { t } = useTranslation();

  const steps: StatusStep[] = [
    {
      key: 'PENDING_SHIPMENT',
      label: t('logistics.pendingShipment') || '待发货',
      icon: <ClockIcon className="w-5 h-5" />,
      activeIcon: <CheckCircleSolidIcon className="w-5 h-5" />,
    },
    {
      key: 'IN_TRANSIT_CHINA',
      label: t('logistics.inTransitChina') || '中国段运输中',
      icon: <TruckIcon className="w-5 h-5" />,
      activeIcon: <CheckCircleSolidIcon className="w-5 h-5" />,
    },
    {
      key: 'IN_TRANSIT_TAJIKISTAN',
      label: t('logistics.inTransitTajikistan') || '塔国段运输中',
      icon: <GlobeAltIcon className="w-5 h-5" />,
      activeIcon: <CheckCircleSolidIcon className="w-5 h-5" />,
    },
    {
      key: 'READY_FOR_PICKUP',
      label: t('logistics.readyForPickup') || '待自提',
      icon: <MapPinIcon className="w-5 h-5" />,
      activeIcon: <CheckCircleSolidIcon className="w-5 h-5" />,
    },
    {
      key: 'PICKED_UP',
      label: t('logistics.pickedUp') || '已提货',
      icon: <CheckCircleIcon className="w-5 h-5" />,
      activeIcon: <CheckCircleSolidIcon className="w-5 h-5" />,
    },
  ];

  const getStatusIndex = (s: string | null): number => {
    if (!s) return 0;
    const index = steps.findIndex(step => step.key === s);
    return index >= 0 ? index : 0;
  };

  const currentIndex = getStatusIndex(status);

  const getStatusColor = (index: number): string => {
    if (index < currentIndex) return 'text-green-500 bg-green-100';
    if (index === currentIndex) return 'text-purple-600 bg-purple-100';
    return 'text-gray-400 bg-gray-100';
  };

  const getLineColor = (index: number): string => {
    if (index < currentIndex) return 'bg-green-500';
    return 'bg-gray-200';
  };

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm ${className}`}>
      <div className="flex items-center space-x-2 mb-6">
        <TruckIcon className="w-5 h-5 text-purple-600" />
        <h2 className="text-base font-bold text-gray-900">
          {t('logistics.title') || '物流状态'}
        </h2>
      </div>

      {/* 物流进度条 */}
      <div className="relative">
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center relative z-10"
              style={{ width: `${100 / steps.length}%` }}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${getStatusColor(index)}`}
              >
                {index <= currentIndex ? step.activeIcon : step.icon}
              </div>
              <span
                className={`text-xs mt-2 text-center ${
                  index <= currentIndex ? 'text-gray-900 font-medium' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </motion.div>
          ))}
        </div>

        {/* 连接线 */}
        <div className="absolute top-5 left-0 right-0 flex justify-between px-5 -z-0">
          {steps.slice(0, -1).map((_, index) => (
            <div
              key={index}
              className={`h-0.5 flex-1 mx-1 ${getLineColor(index)}`}
            />
          ))}
        </div>
      </div>

      {/* 物流详情 */}
      <div className="mt-6 space-y-3">
        {chinaTrackingNo && (
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">
              {t('logistics.chinaTrackingNo') || '中国段物流单号'}
            </span>
            <span className="font-medium text-gray-900 text-sm">{chinaTrackingNo}</span>
          </div>
        )}

        {tajikistanTrackingNo && (
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">
              {t('logistics.tajikistanTrackingNo') || '塔国段物流单号'}
            </span>
            <span className="font-medium text-gray-900 text-sm">{tajikistanTrackingNo}</span>
          </div>
        )}

        {estimatedArrivalDate && status && ['IN_TRANSIT_CHINA', 'IN_TRANSIT_TAJIKISTAN'].includes(status) && (
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">
              {t('logistics.estimatedArrival') || '预计到达'}
            </span>
            <span className="font-medium text-gray-900 text-sm">{estimatedArrivalDate}</span>
          </div>
        )}

        {pickupCode && status === 'READY_FOR_PICKUP' && (
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">
              {t('logistics.pickupCode') || '提货码'}
            </span>
            <span className="font-bold text-purple-600 text-lg tracking-wider">{pickupCode}</span>
          </div>
        )}
      </div>

      {/* 状态说明 */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          {status === 'PENDING_SHIPMENT' && (t('logistics.pendingShipmentDesc') || '您的订单正在等待发货，请耐心等待。')}
          {status === 'IN_TRANSIT_CHINA' && (t('logistics.inTransitChinaDesc') || '您的包裹正在中国境内运输，即将发往塔吉克斯坦。')}
          {status === 'IN_TRANSIT_TAJIKISTAN' && (t('logistics.inTransitTajikistanDesc') || '您的包裹已到达塔吉克斯坦，正在派送至自提点。')}
          {status === 'READY_FOR_PICKUP' && (t('logistics.readyForPickupDesc') || '您的包裹已到达自提点，请携带提货码前往提货。')}
          {status === 'PICKED_UP' && (t('logistics.pickedUpDesc') || '您已成功提货，感谢您的购买！')}
        </p>
      </div>
    </div>
  );
};

export default LogisticsStatus;
