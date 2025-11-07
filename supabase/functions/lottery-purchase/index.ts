Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
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
        const { lotteryId, quantity, paymentMethod, userNumbers } = await req.json();

        if (!lotteryId || !quantity || !paymentMethod) {
            throw new Error('Missing required parameters: lotteryId, quantity, paymentMethod');
        }

        if (quantity <= 0 || quantity > 100) {
            throw new Error('Invalid quantity: must be between 1 and 100');
        }

        // 获取用户信息（从 auth header）
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('No authorization header');
        }

        const token = authHeader.replace('Bearer ', '');

        // 验证用户 token
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': serviceRoleKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid token');
        }

        const authUser = await userResponse.json();
        const userId = authUser.id;

        // 获取用户详细信息
        const userDetailResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=*`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        const users = await userDetailResponse.json();
        if (users.length === 0) {
            throw new Error('User not found');
        }
        const user = users[0];

        // 获取彩票信息
        const lotteryResponse = await fetch(`${supabaseUrl}/rest/v1/lotteries?id=eq.${lotteryId}&select=*`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        const lotteries = await lotteryResponse.json();
        if (lotteries.length === 0) {
            throw new Error('Lottery not found');
        }
        const lottery = lotteries[0];

        // 验证彩票状态
        if (lottery.status !== 'ACTIVE') {
            throw new Error(`Lottery is not active. Current status: ${lottery.status}`);
        }

        // 检查是否售完
        if (lottery.sold_tickets + quantity > lottery.total_tickets) {
            throw new Error('Not enough tickets available');
        }

        // 检查用户购买限制
        const userEntriesResponse = await fetch(`${supabaseUrl}/rest/v1/lottery_entries?user_id=eq.${userId}&lottery_id=eq.${lotteryId}&status=eq.ACTIVE&select=id`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        const userEntries = await userEntriesResponse.json();
        if (userEntries.length + quantity > lottery.max_per_user) {
            throw new Error(`Exceeds maximum purchase limit per user: ${lottery.max_per_user}`);
        }

        // 计算总金额
        const totalAmount = lottery.ticket_price * quantity;

        // 获取用户钱包
        const walletType = paymentMethod === 'BALANCE_WALLET' ? 'BALANCE' : 'LUCKY_COIN';
        const walletResponse = await fetch(`${supabaseUrl}/rest/v1/wallets?user_id=eq.${userId}&type=eq.${walletType}&currency=eq.${lottery.currency}&select=*`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

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
            selected_numbers: userNumbers || null,
            status: 'PENDING',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            expired_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30分钟过期
        };

        const createOrderResponse = await fetch(`${supabaseUrl}/rest/v1/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(orderData)
        });

        if (!createOrderResponse.ok) {
            const errorText = await createOrderResponse.text();
            throw new Error(`Failed to create order: ${errorText}`);
        }

        const orders = await createOrderResponse.json();
        const order = orders[0];

        // 生成彩票号码并创建彩票记录
        const generateLotteryNumbers = (count: number, existingNumbers: Set<string>): string[] => {
            const numbers: string[] = [];
            const maxAttempts = count * 10; // 防止无限循环
            let attempts = 0;

            while (numbers.length < count && attempts < maxAttempts) {
                // 生成5位数字号码 (10000-99999)
                const num = Math.floor(Math.random() * 90000) + 10000;
                const numStr = num.toString();
                
                if (!existingNumbers.has(numStr)) {
                    numbers.push(numStr);
                    existingNumbers.add(numStr);
                }
                attempts++;
            }

            if (numbers.length < count) {
                throw new Error('Unable to generate unique lottery numbers');
            }

            return numbers;
        };

        // 获取已存在的号码
        const existingNumbersResponse = await fetch(`${supabaseUrl}/rest/v1/lottery_entries?lottery_id=eq.${lotteryId}&select=numbers`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        const existingEntries = await existingNumbersResponse.json();
        const existingNumbers = new Set<string>();
        existingEntries.forEach((entry: any) => {
            if (typeof entry.numbers === 'string') {
                existingNumbers.add(entry.numbers);
            }
        });

        // 生成新号码
        const newNumbers = userNumbers && userNumbers.length === quantity 
            ? userNumbers.map((num: any) => num.toString())
            : generateLotteryNumbers(quantity, existingNumbers);

        // 创建彩票记录
        const lotteryEntries = newNumbers.map((number: string) => ({
            user_id: userId,
            lottery_id: lotteryId,
            order_id: order.id,
            numbers: number,
            is_winning: false,
            status: 'ACTIVE',
            is_from_market: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        const createEntriesResponse = await fetch(`${supabaseUrl}/rest/v1/lottery_entries`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(lotteryEntries)
        });

        if (!createEntriesResponse.ok) {
            const errorText = await createEntriesResponse.text();
            // 回滚订单
            await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${order.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'CANCELLED' })
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
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                balance: newBalance,
                version: wallet.version + 1,
                updated_at: new Date().toISOString()
            })
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
            processed_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        };

        await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transactionData)
        });

        // 更新订单状态
        await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${order.id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'PAID',
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
        });

        // 更新彩票已售数量
        await fetch(`${supabaseUrl}/rest/v1/lotteries?id=eq.${lotteryId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sold_tickets: lottery.sold_tickets + quantity,
                updated_at: new Date().toISOString()
            })
        });

        // 处理推荐佣金（如果有推荐人）
        if (user.referred_by_id) {
            const commissionRate = 0.05; // 5% 佣金
            const commissionAmount = totalAmount * commissionRate;

            const commissionData = {
                user_id: user.referred_by_id,
                from_user_id: userId,
                level: 1,
                type: 'LOTTERY_PURCHASE',
                amount: commissionAmount,
                rate: commissionRate,
                source_amount: totalAmount,
                related_order_id: order.id,
                related_lottery_id: lotteryId,
                status: 'PENDING',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            await fetch(`${supabaseUrl}/rest/v1/commissions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(commissionData)
            });
        }

        // 检查是否售罄，如果售罄则触发自动开奖
        const newSoldTickets = lottery.sold_tickets + quantity;
        if (newSoldTickets >= lottery.total_tickets) {
            // 异步调用售罄检测函数，不等待结果
            fetch(`${supabaseUrl}/functions/v1/check-lottery-sold-out`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceRoleKey}`
                },
                body: JSON.stringify({ lotteryId: lotteryId })
            }).catch(err => {
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
                status: 'PAID'
            },
            lottery_entries: entries,
            remaining_balance: newBalance,
            is_sold_out: newSoldTickets >= lottery.total_tickets
        };

        return new Response(JSON.stringify({ data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Lottery purchase error:', error);

        const errorResponse = {
            error: {
                code: 'PURCHASE_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});