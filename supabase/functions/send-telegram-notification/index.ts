import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper function to create response with CORS headers
function createResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Generate unique notification ID
function generateNotificationId(): string {
  return `NOTIF${Date.now()}${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { user_id, type, data, priority = 2 } = await req.json();

    if (!user_id || !type) {
      return createResponse({ 
        success: false, 
        error: 'user_id and type are required' 
      }, 400);
    }

    // Get user information (telegram_id and language preference)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('telegram_id, preferred_language')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      console.error('User not found:', userError);
      return createResponse({ 
        success: false, 
        error: 'User not found' 
      }, 404);
    }

    if (!user.telegram_id) {
      console.log(`User ${user_id} has no telegram_id, skipping notification`);
      return createResponse({ 
        success: true, 
        message: 'User has no telegram_id, notification skipped' 
      });
    }

    // Insert notification into queue
    const notificationId = generateNotificationId();
    const { error: insertError } = await supabase
      .from('notification_queue')
      .insert({
        id: notificationId,
        user_id: user_id,
        telegram_chat_id: parseInt(user.telegram_id),
        notification_type: type,
        title: '', // Will be generated from template
        message: '', // Will be generated from template
        data: data || {},
        priority: priority,
        scheduled_at: new Date().toISOString(),
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Failed to insert notification:', insertError);
      return createResponse({ 
        success: false, 
        error: 'Failed to queue notification' 
      }, 500);
    }

    console.log(`Notification queued: ${notificationId} for user ${user_id}, type: ${type}`);

    return createResponse({
      success: true,
      notification_id: notificationId,
      message: 'Notification queued successfully'
    });

  } catch (error) {
    console.error('Send telegram notification error:', error);
    return createResponse({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});
