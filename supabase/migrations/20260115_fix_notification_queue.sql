-- Fix notification_queue table structure
-- Add missing fields required by send-telegram-notification function

-- Add missing columns
ALTER TABLE notification_queue 
ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT,
ADD COLUMN IF NOT EXISTS notification_type TEXT,
ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS message TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_created_at ON notification_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_at ON notification_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON notification_queue(user_id);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_notification_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notification_queue_updated_at ON notification_queue;
CREATE TRIGGER trigger_update_notification_queue_updated_at
  BEFORE UPDATE ON notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_queue_updated_at();

-- Comment on table and columns
COMMENT ON TABLE notification_queue IS 'Queue for Telegram bot notifications';
COMMENT ON COLUMN notification_queue.telegram_chat_id IS 'Telegram chat ID for the user';
COMMENT ON COLUMN notification_queue.notification_type IS 'Type of notification (e.g., lottery_win, wallet_deposit)';
COMMENT ON COLUMN notification_queue.priority IS 'Priority level: 1=high, 2=medium, 3=low';
COMMENT ON COLUMN notification_queue.retry_count IS 'Number of retry attempts';
COMMENT ON COLUMN notification_queue.max_retries IS 'Maximum number of retries allowed';
