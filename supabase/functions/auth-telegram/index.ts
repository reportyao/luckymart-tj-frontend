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
        const { initData, startParam } = await req.json();

        if (!initData) {
            throw new Error('Telegram initData is required');
        }

        // 解析 Telegram initData
        const urlParams = new URLSearchParams(initData);
        const userDataRaw = urlParams.get('user');
        const hash = urlParams.get('hash');
        const authDate = urlParams.get('auth_date');

        if (!userDataRaw || !hash || !authDate) {
            throw new Error('Invalid initData format');
        }

        // 解析用户数据
        const userData = JSON.parse(userDataRaw);
        const telegramId = userData.id.toString();

        // 验证 initData 时效性（24小时内有效）
        const authTimestamp = parseInt(authDate) * 1000;
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24小时

        if (now - authTimestamp > maxAge) {
            throw new Error('InitData expired');
        }

        // 生成推荐码（基于 telegramId）
        const generateReferralCode = (telegramId: string): string => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            const base = parseInt(telegramId) || 12345;
            let result = '';
            let num = base;
            
            while (result.length < 8) {
                result = chars[num % chars.length] + result;
                num = Math.floor(num / chars.length) || 1;
            }
            
            return 'LM' + result.substring(0, 6);
        };

        const referralCode = generateReferralCode(telegramId);

        // 处理推荐关系
        let referredById = null;
        if (startParam && startParam.startsWith('ref_')) {
            const referralCodeFromParam = startParam.substring(4);
            
            // 查找推荐人
            const referrerResponse = await fetch(`${supabaseUrl}/rest/v1/users?referral_code=eq.${referralCodeFromParam}&select=id`, {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            });

            if (referrerResponse.ok) {
                const referrerData = await referrerResponse.json();
                if (referrerData.length > 0) {
                    referredById = referrerData[0].id;
                }
            }
        }

        // 检查用户是否已存在
        const existingUserResponse = await fetch(`${supabaseUrl}/rest/v1/users?telegram_id=eq.${telegramId}&select=*`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        const existingUsers = await existingUserResponse.json();
        let user;

        if (existingUsers.length > 0) {
            // 更新现有用户
            user = existingUsers[0];
            
            const updateData: any = {
                telegram_username: userData.username || null,
                first_name: userData.first_name || null,
                last_name: userData.last_name || null,
                language_code: userData.language_code || 'zh',
                avatar_url: userData.photo_url || user.avatar_url || null,
                last_login_at: new Date().toISOString(),
                last_active_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // 如果用户还没有推荐人，且有有效的推荐码，则设置推荐关系
            if (!user.referred_by_id && referredById) {
                updateData.referrer_id = referredById;
                updateData.referred_by_id = referredById;
            }

            const updateResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(updateData)
            });

            if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                throw new Error(`Failed to update user: ${errorText}`);
            }

            const updatedUsers = await updateResponse.json();
            user = updatedUsers[0];
        } else {
            // 创建新用户
            const newUserData = {
                telegram_id: telegramId,
                telegram_username: userData.username || null,
                first_name: userData.first_name || null,
                last_name: userData.last_name || null,
                language_code: userData.language_code || 'zh',
                avatar_url: userData.photo_url || null,
                referral_code: referralCode,
                referred_by_id: referredById,
                referrer_id: referredById,
                status: 'ACTIVE',
                is_verified: false,
                kyc_level: 'NONE',
                two_factor_enabled: false,
                last_login_at: new Date().toISOString(),
                last_active_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const createResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(newUserData)
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                throw new Error(`Failed to create user: ${errorText}`);
            }

            const newUsers = await createResponse.json();
            user = newUsers[0];

            // 为新用户创建钱包
            const wallets = [
                {
                    user_id: user.id,
                    type: 'BALANCE',
                    currency: 'TJS',
                    balance: 0,
                    frozen_balance: 0,
                    total_deposits: 0,
                    total_withdrawals: 0,
                    version: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    user_id: user.id,
                    type: 'LUCKY_COIN',
                    currency: 'TJS',
                    balance: 0,
                    frozen_balance: 0,
                    total_deposits: 0,
                    total_withdrawals: 0,
                    version: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ];

            const createWalletsResponse = await fetch(`${supabaseUrl}/rest/v1/wallets`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(wallets)
            });

            if (!createWalletsResponse.ok) {
                const errorText = await createWalletsResponse.text();
                console.error('Failed to create wallets:', errorText);
                // 钱包创建失败不影响用户认证，只记录错误
            }
        }

        // 获取用户钱包信息
        const walletsResponse = await fetch(`${supabaseUrl}/rest/v1/wallets?user_id=eq.${user.id}&select=*`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        const wallets = walletsResponse.ok ? await walletsResponse.json() : [];

        // 创建会话token（简单实现）
        const sessionToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天后过期

        // 创建用户会话
        const sessionData = {
            user_id: user.id,
            session_token: sessionToken,
            device: 'telegram_mini_app',
            is_active: true,
            expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString()
        };

        const createSessionResponse = await fetch(`${supabaseUrl}/rest/v1/user_sessions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(sessionData)
        });

        let session = null;
        if (createSessionResponse.ok) {
            const sessions = await createSessionResponse.json();
            session = sessions[0];
        }

        // 返回认证结果
        const result = {
            success: true,
            user: {
                id: user.id,
                telegram_id: user.telegram_id,
                telegram_username: user.telegram_username,
                first_name: user.first_name,
                last_name: user.last_name,
                language_code: user.language_code,
                referral_code: user.referral_code,
                status: user.status,
                is_verified: user.is_verified,
                kyc_level: user.kyc_level
            },
            wallets: wallets,
            session: session ? {
                token: session.session_token,
                expires_at: session.expires_at
            } : null,
            is_new_user: existingUsers.length === 0
        };

        return new Response(JSON.stringify({ data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Authentication error:', error);

        const errorResponse = {
            error: {
                code: 'AUTH_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});