const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // 1. 获取所有用户
    const usersResponse = await fetch(`${supabaseUrl}/rest/v1/users?select=id,username`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      }
    });
    const users = await usersResponse.json();
    
    const results = [];
    
    for (const user of users) {
      const userResult = {
        user_id: user.id,
        username: user.username,
        spin_success: false,
        ai_success: false
      };

      // 2. 增加10次抽奖机会
      try {
        const spinResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/add_user_spin_count`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_user_id: user.id,
            p_count: 10,
            p_source: 'admin_test_bonus'
          })
        });
        
        if (spinResponse.ok) {
          userResult.spin_success = true;
          userResult.spin_count = await spinResponse.json();
        }
      } catch (e) {
        userResult.spin_error = e.message;
      }

      // 3. 增加100次AI提问机会
      try {
        const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-add-bonus`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: user.id,
            amount: 100,
            reason: 'admin_test_bonus'
          })
        });

        if (aiResponse.ok) {
          userResult.ai_success = true;
          userResult.ai_result = await aiResponse.json();
        }
      } catch (e) {
        userResult.ai_error = e.message;
      }

      results.push(userResult);
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
