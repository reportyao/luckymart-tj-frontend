import React, { createContext, useContext, ReactNode } from 'react';
import { useRealtimeNotifications, RealtimeNotification } from '@/hooks/useRealtimeNotifications';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface RealtimeNotificationsContextType {
  isConnected: boolean;
  lastMessage: RealtimeNotification | null;
  reconnect: () => void;
  disconnect: () => void;
}

const RealtimeNotificationsContext = createContext<RealtimeNotificationsContextType | undefined>(undefined);

export function useRealtimeNotificationsContext() {
  const context = useContext(RealtimeNotificationsContext);
  if (!context) {
    throw new Error('useRealtimeNotificationsContext must be used within RealtimeNotificationsProvider');
  }
  return context;
}

interface RealtimeNotificationsProviderProps {
  children: ReactNode;
}

export function RealtimeNotificationsProvider({ children }: RealtimeNotificationsProviderProps) {
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleNotification = (notification: RealtimeNotification) => {
    const { data } = notification;

    // Show toast notification based on type
    switch (data?.notification_type) {
      case 'group_buy_win':
        toast({
          title: t('notifications.groupBuyWin.title'),
          description: t('notifications.groupBuyWin.description', { 
            productName: data.data?.product_name 
          }),
          variant: 'default',
        });
        break;

      case 'group_buy_refund':
        toast({
          title: t('notifications.groupBuyRefund.title'),
          description: t('notifications.groupBuyRefund.description', { 
            amount: data.data?.refund_amount 
          }),
          variant: 'default',
        });
        break;

      case 'wallet_deposit':
        toast({
          title: t('notifications.deposit.title'),
          description: t('notifications.deposit.description', { 
            amount: data.data?.transaction_amount 
          }),
          variant: 'default',
        });
        break;

      case 'wallet_withdraw_completed':
        toast({
          title: t('notifications.withdrawalCompleted.title'),
          description: t('notifications.withdrawalCompleted.description'),
          variant: 'default',
        });
        break;

      case 'lottery_win':
        toast({
          title: t('notifications.lotteryWin.title'),
          description: t('notifications.lotteryWin.description', { 
            prize: data.data?.prize_amount 
          }),
          variant: 'default',
        });
        break;

      default:
        // Generic notification
        if (data?.title) {
          toast({
            title: data.title,
            description: data.message,
            variant: 'default',
          });
        }
    }
  };

  const handleBalanceUpdate = (balance: { balance: number; frozen_balance: number; currency: string }) => {
    // Dispatch custom event for balance update
    window.dispatchEvent(new CustomEvent('balance-updated', { detail: balance }));
  };

  const handleGroupBuyUpdate = (session: any) => {
    // Dispatch custom event for group buy update
    window.dispatchEvent(new CustomEvent('group-buy-updated', { detail: session }));
  };

  const handleError = (error: Error) => {
    console.error('Realtime notifications error:', error);
    // Optionally show error toast
    // toast({
    //   title: 'Connection Error',
    //   description: 'Failed to connect to realtime notifications',
    //   variant: 'destructive',
    // });
  };

  const { isConnected, lastMessage, reconnect, disconnect } = useRealtimeNotifications({
    enabled: true,
    onNotification: handleNotification,
    onBalanceUpdate: handleBalanceUpdate,
    onGroupBuyUpdate: handleGroupBuyUpdate,
    onError: handleError,
  });

  return (
    <RealtimeNotificationsContext.Provider
      value={{
        isConnected,
        lastMessage,
        reconnect,
        disconnect,
      }}
    >
      {children}
    </RealtimeNotificationsContext.Provider>
  );
}
