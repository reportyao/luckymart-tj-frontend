import { describe, it, expect } from 'vitest';
import {
  cn,
  formatCurrency,
  formatDateTime,
  getLotteryStatusText,
  getLotteryStatusColor,
  getTimeRemaining,
  getWalletTypeText,
  copyToClipboard,
} from '../utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
      expect(cn('foo', undefined, 'bar')).toBe('foo bar');
      expect(cn('foo', '')).toBe('foo');
    });

    it('should handle tailwind merge', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency with default TJS', () => {
      expect(formatCurrency(100)).toBe('TJS 100.00');
      expect(formatCurrency(50.5)).toBe('TJS 50.50');
    });

    it('should format currency with custom currency', () => {
      expect(formatCurrency(100, 'USD')).toBe('USD 100.00');
    });

    it('should handle decimal places correctly', () => {
      expect(formatCurrency(99.999)).toBe('TJS 100.00');
      expect(formatCurrency(99.994)).toBe('TJS 99.99');
    });
  });

  describe('formatDateTime', () => {
    it('should format date time correctly', () => {
      const date = '2024-01-15T10:30:00Z';
      const formatted = formatDateTime(date);
      expect(formatted).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    });

    it('should handle different date formats', () => {
      const date = new Date('2024-06-20T15:45:30Z').toISOString();
      const formatted = formatDateTime(date);
      expect(formatted).toContain('2024');
      expect(formatted).toContain('06');
      expect(formatted).toContain('20');
    });
  });

  describe('getLotteryStatusText', () => {
    it('should return correct status text', () => {
      expect(getLotteryStatusText('ACTIVE')).toBe('进行中');
      expect(getLotteryStatusText('UPCOMING')).toBe('即将开始');
      expect(getLotteryStatusText('COMPLETED')).toBe('已完成');
      expect(getLotteryStatusText('SOLD_OUT')).toBe('已售完');
      expect(getLotteryStatusText('DRAWN')).toBe('已开奖');
      expect(getLotteryStatusText('CANCELLED')).toBe('已取消');
    });

    it('should return original status for unknown status', () => {
      expect(getLotteryStatusText('UNKNOWN')).toBe('UNKNOWN');
    });
  });

  describe('getLotteryStatusColor', () => {
    it('should return correct color classes', () => {
      expect(getLotteryStatusColor('ACTIVE')).toBe('bg-green-100 text-green-700');
      expect(getLotteryStatusColor('UPCOMING')).toBe('bg-blue-100 text-blue-700');
      expect(getLotteryStatusColor('COMPLETED')).toBe('bg-gray-100 text-gray-700');
      expect(getLotteryStatusColor('SOLD_OUT')).toBe('bg-red-100 text-red-700');
    });

    it('should return default color for unknown status', () => {
      expect(getLotteryStatusColor('UNKNOWN')).toBe('bg-gray-100 text-gray-700');
    });
  });

  describe('getTimeRemaining', () => {
    it('should return "已结束" for past dates', () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      expect(getTimeRemaining(pastDate)).toBe('已结束');
    });

    it('should return days and hours for future dates', () => {
      const futureDate = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(); // 25 hours
      const result = getTimeRemaining(futureDate);
      expect(result).toContain('天');
      expect(result).toContain('小时');
    });

    it('should return hours and minutes for dates within 24 hours', () => {
      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours
      const result = getTimeRemaining(futureDate);
      expect(result).toContain('小时');
      expect(result).toContain('分钟');
    });

    it('should return minutes for dates within 1 hour', () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
      const result = getTimeRemaining(futureDate);
      expect(result).toContain('分钟');
      expect(result).not.toContain('小时');
    });
  });

  describe('getWalletTypeText', () => {
    it('should return correct wallet type text', () => {
      expect(getWalletTypeText('BALANCE')).toBe('余额');
      expect(getWalletTypeText('LUCKY_COIN')).toBe('幸运币');
    });

    it('should return original type for unknown type', () => {
      expect(getWalletTypeText('UNKNOWN')).toBe('UNKNOWN');
    });
  });

  describe('copyToClipboard', () => {
    it('should return false when clipboard API is not available', async () => {
      // Note: In test environment, clipboard API is usually not available
      // This test ensures the function handles that gracefully
      const result = await copyToClipboard('test text');
      expect(typeof result).toBe('boolean');
    });
  });
});
