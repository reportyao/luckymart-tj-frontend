Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 获取 Supabase 配置
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!serviceRoleKey || !supabaseUrl) {
      throw new Error('Supabase configuration missing');
    }

    // 解析请求数据
    const { lotteryId, quantity, paymentMethod, session_token } = await req.json();

    if (!lotteryId || !quantity || !paymentMethod) {
      throw new Error('Missing required parameters: lotteryId, quantity, paymentMethod');
    }

    if (quantity <= 0 || quantity > 100) {
      throw new Error('Invalid quantity: must be between 1 and 100');
    }

    // ✅ 使用自定义 session token 验证用户
    // 优先从 body 获取，其次从 header 获取
    let sessionToken = session_token;
    if (!sessionToken) {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        sessionToken = authHeader.replace('Bearer ', '');
      }
    }
    
    if (!sessionToken) {
      throw new Error('Missing session token');
    }

    // ✅ 查询 user_sessions 表验证 token
    const sessionResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_sessions?session_token=eq.${sessionToken}&is_active=eq.true&select=*`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!sessionResponse.ok) {
      throw new Error('Invalid session token');
    }

    const sessions = await sessionResponse.json();
    if (sessions.length === 0) {
      throw new Error('Session not found or expired');
    }

    const session = sessions[0];

    // ✅ 检查 session 是否过期
    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      throw new Error('Session expired');
    }

    // ✅ 单独查询用户信息
    const userResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${session.user_id}&select=*`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!userResponse.ok) {
      throw new Error('User not found');
    }

    const users = await userResponse.json();
    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];
    const userId = user.id;

    // ✅ 获取彩票信息（使用 FOR UPDATE 行锁防止并发超卖）
    // 注意：Supabase REST API 不直接支持 FOR UPDATE，需要使用 RPC 函数
    // 这里先查询，后续会在更新时检查版本号
    const lotteryResponse = await fetch(
      `${supabaseUrl}/rest/v1/lotteries?id=eq.${lotteryId}&select=*`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const lotteries = await lotteryResponse.json();
    if (lotteries.length === 0) {
      throw new Error('Lottery not found');
    }

    const lottery = lotteries[0];

    // 验证彩票状态
    if (lottery.status !== 'ACTIVE') {
      throw new Error(`Lottery is not active. Current status: ${lottery.status}`);
    }

    // ✅ 检查是否售完（关键：防止超卖）
    if (lottery.sold_tickets + quantity > lottery.total_tickets) {
      throw new Error('Not enough tickets available');
    }

    // 检查用户购买限制
    const userEntriesResponse = await fetch(
      `${supabaseUrl}/rest/v1/lottery_entries?user_id=eq.${userId}&lottery_id=eq.${lotteryId}&status=eq.ACTIVE&select=id`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const userEntries = await userEntriesResponse.json();
    
    // ✅ 支持无限购买
    if (!lottery.unlimited_purchase && lottery.max_per_user) {
      if (userEntries.length + quantity > lottery.max_per_user) {
        throw new Error(`Exceeds maximum purchase limit per user: ${lottery.max_per_user}`);
      }
    }

    // 计算总金额
    const totalAmount = lottery.ticket_price * quantity;

    // 获取用户钱包
    // 注意：数据库中现金余额的type是'TJS'，积分的currency是'POINTS'
    const walletType = paymentMethod === 'BALANCE_WALLET' ? 'TJS' : 'LUCKY_COIN';
    const walletCurrency = paymentMethod === 'BALANCE_WALLET' ? lottery.currency : 'POINTS';
    const walletResponse = await fetch(
      `${supabaseUrl}/rest/v1/wallets?user_id=eq.${userId}&type=eq.${walletType}&currency=eq.${walletCurrency}&select=*`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const wallets = await walletResponse.json();
    if (wallets.length === 0) {
      throw new Error('Wallet not found');
    }

    const wallet = wallets[0];

    // 检查钱包余额
    if (wallet.balance < totalAmount) {
      throw new Error('Insufficient wallet balance');
    }

    // 生成订单号
    const orderNumber = `LT${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // 创建订单
    const orderData = {
      user_id: userId,
      order_number: orderNumber,
      type: 'LOTTERY_PURCHASE',
      total_amount: totalAmount,
      currency: lottery.currency,
      payment_method: paymentMethod,
      lottery_id: lotteryId,
      quantity: quantity,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const createOrderResponse = await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(orderData),
    });

    if (!createOrderResponse.ok) {
      const errorText = await createOrderResponse.text();
      throw new Error(`Failed to create order: ${errorText}`);
    }

    const orders = await createOrderResponse.json();
    const order = orders[0];

    // ✅ 生成连续7位数参与码
    // 逻辑：从 1000000 + lottery.sold_tickets 开始分配连续号码
    // 例如：已售0份，分配 1000000, 1000001, 1000002
    //      已售10份，分配 1000010, 1000011, 1000012
    const generateConsecutiveNumbers = (startIndex: number, count: number) => {
      const numbers = [];
      const baseNumber = 1000000; // 7位数起始值
      
      for (let i = 0; i < count; i++) {
        const number = baseNumber + startIndex + i;
        numbers.push(number.toString());
      }
      
      return numbers;
    };

    // 生成连续号码
    const newNumbers = generateConsecutiveNumbers(lottery.sold_tickets, quantity);

    // 创建彩票记录
    const lotteryEntries = newNumbers.map((number) => ({
      user_id: userId,
      lottery_id: lotteryId,
      order_id: order.id,
      numbers: number, // 7位数参与码（字符串）
      is_winning: false,
      status: 'ACTIVE',
      is_from_market: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const createEntriesResponse = await fetch(`${supabaseUrl}/rest/v1/lottery_entries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(lotteryEntries),
    });

    if (!createEntriesResponse.ok) {
      const errorText = await createEntriesResponse.text();
      // 回滚订单
      await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${order.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      throw new Error(`Failed to create lottery entries: ${errorText}`);
    }

    const entries = await createEntriesResponse.json();

    // 更新钱包余额
    const newBalance = wallet.balance - totalAmount;
    const updateWalletResponse = await fetch(`${supabaseUrl}/rest/v1/wallets?id=eq.${wallet.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        balance: newBalance,
        version: wallet.version + 1,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!updateWalletResponse.ok) {
      const errorText = await updateWalletResponse.text();
      throw new Error(`Failed to update wallet: ${errorText}`);
    }

    // 创建钱包交易记录
    const transactionData = {
      wallet_id: wallet.id,
      type: 'LOTTERY_PURCHASE',
      amount: -totalAmount,
      balance_before: wallet.balance,
      balance_after: newBalance,
      status: 'COMPLETED',
      description: `彩票购买 - 订单 ${orderNumber}`,
      related_order_id: order.id,
      related_lottery_id: lotteryId,
      created_at: new Date().toISOString(),
    };

    await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionData),
    });

    // 更新订单状态
    await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${order.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'PAID',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    // ✅ 更新彩票已售数量，并在售罄时同时更新状态和开奖时间（原子操作）
    const newSoldTickets = lottery.sold_tickets + quantity;
    const isSoldOut = newSoldTickets >= lottery.total_tickets;
    
    // 准备更新数据
    const updateData: any = {
      sold_tickets: newSoldTickets,
      updated_at: new Date().toISOString(),
    };
    
    // 如果售罄，同时更新状态和开奖时间
    if (isSoldOut) {
      const drawTime = new Date(Date.now() + 180 * 1000); // 180秒后开奖
      updateData.status = 'SOLD_OUT';
      updateData.draw_time = drawTime.toISOString();
    }
    
    const updateLotteryResponse = await fetch(`${supabaseUrl}/rest/v1/lotteries?id=eq.${lotteryId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!updateLotteryResponse.ok) {
      console.error('Failed to update lottery:', await updateLotteryResponse.text());
    }

    // 处理推荐佣金（使用handle-purchase-commission进行三级分销）
    if (user.referred_by_id) {
      try {
        const commissionResponse = await fetch(`${supabaseUrl}/functions/v1/handle-purchase-commission`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_id: order.id,
            user_id: userId,
            order_amount: totalAmount
          }),
        });
        
        if (!commissionResponse.ok) {
          console.error('Failed to process commission:', await commissionResponse.text());
        }
      } catch (commissionError) {
        console.error('Commission processing error:', commissionError);
        // 不阻断购买流程
      }
    }

    // ✅ 如果售罄，异步调用售罄检测函数（用于触发定时开奖）
    if (isSoldOut) {
      fetch(`${supabaseUrl}/functions/v1/check-lottery-sold-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ lotteryId: lotteryId }),
      }).catch((err) => {
        console.error('Failed to trigger sold-out check:', err);
      });
    }

    // 返回购买结果
    const result = {
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        total_amount: totalAmount,
        status: 'PAID',
      },
      lottery_entries: entries,
      participation_codes: newNumbers, // 返回分配的7位数参与码
      remaining_balance: newBalance,
      is_sold_out: isSoldOut,
    };

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Lottery purchase error:', error);

    const errorResponse = {
      error: {
        code: 'PURCHASE_FAILED',
        message: error.message,
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
