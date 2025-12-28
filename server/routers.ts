import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { supabase, paginatedQuery } from "./supabase";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // 用户管理
  users: router({
    list: protectedProcedure
      .input(z.object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        search: z.string().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let query = supabase.from('users').select('*', { count: 'exact' });
        
        if (input.search) {
          query = query.or(`telegram_username.ilike.%${input.search}%,first_name.ilike.%${input.search}%,telegram_id.ilike.%${input.search}%`);
        }
        
        if (input.status) {
          query = query.eq('status', input.status);
        }
        
        query = query.order('created_at', { ascending: false });
        
        return await paginatedQuery(query, { page: input.page, pageSize: input.pageSize });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', input.id)
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED'])
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await supabase
          .from('users')
          .update({ status: input.status, updated_at: new Date().toISOString() })
          .eq('id', input.id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    adjustBalance: protectedProcedure
      .input(z.object({
        userId: z.string(),
        amount: z.number(),
        type: z.enum(['BALANCE', 'LOTTERY_COINS']),
        reason: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('balance, lottery_coins')
          .eq('id', input.userId)
          .single();
        
        if (userError) throw new Error(userError.message);

        const updateData: any = { updated_at: new Date().toISOString() };
        
        if (input.type === 'BALANCE') {
          updateData.balance = (user.balance || 0) + input.amount;
        } else {
          updateData.lottery_coins = (user.lottery_coins || 0) + input.amount;
        }

        const { data, error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', input.userId)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    getStats: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        // 获取用户的购买统计
        const { data: tickets, error: ticketsError } = await supabase
          .from('tickets')
          .select('*')
          .eq('user_id', input.id);
        
        // 获取用户的中奖统计
        const { data: prizes, error: prizesError } = await supabase
          .from('prizes')
          .select('*')
          .eq('user_id', input.id);
        
        // 获取用户的充值统计
        const { data: deposits, error: depositsError } = await supabase
          .from('deposit_requests')
          .select('amount')
          .eq('user_id', input.id)
          .eq('status', 'APPROVED');
        
        // 获取用户的提现统计
        const { data: withdrawals, error: withdrawalsError } = await supabase
          .from('withdrawal_requests')
          .select('amount')
          .eq('user_id', input.id)
          .eq('status', 'COMPLETED');

        const totalDeposit = deposits?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
        const totalWithdrawal = withdrawals?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;

        return {
          totalTickets: tickets?.length || 0,
          totalPrizes: prizes?.length || 0,
          totalDeposit,
          totalWithdrawal,
        };
      }),
  }),

  // 积分商城商品管理
  lotteries: router({
    list: protectedProcedure
      .input(z.object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let query = supabase.from('lotteries').select('*', { count: 'exact' });
        
        if (input.status) {
          query = query.eq('status', input.status);
        }
        
        query = query.order('created_at', { ascending: false });
        
        return await paginatedQuery(query, { page: input.page, pageSize: input.pageSize });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from('lotteries')
          .select('*')
          .eq('id', input.id)
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    create: protectedProcedure
      .input(z.object({
        period: z.string(),
        title: z.string(),
        description: z.string().optional(),
        ticket_price: z.number(),
        total_tickets: z.number(),
        max_per_user: z.number(),
        currency: z.string().default('TJS'),
        start_time: z.string(),
        end_time: z.string(),
        draw_time: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await supabase
          .from('lotteries')
          .insert({
            ...input,
            status: 'PENDING',
            sold_tickets: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.string(),
        period: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        ticket_price: z.number().optional(),
        total_tickets: z.number().optional(),
        max_per_user: z.number().optional(),
        currency: z.string().optional(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
        draw_time: z.string().optional(),
        images: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        const { data, error } = await supabase
          .from('lotteries')
          .update({ ...updateData, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'])
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await supabase
          .from('lotteries')
          .update({ status: input.status, updated_at: new Date().toISOString() })
          .eq('id', input.id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    draw: protectedProcedure
      .input(z.object({
        id: z.string(),
        winnerCount: z.number().default(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const { data: lottery, error: lotteryError } = await supabase
          .from('lotteries')
          .select('*')
          .eq('id', input.id)
          .single();
        
        if (lotteryError) throw new Error(lotteryError.message);
        if (!lottery) throw new Error('Lottery not found');
        if (lottery.status !== 'ACTIVE') throw new Error('Lottery is not active');

        const { data: entries, error: entriesError } = await supabase
          .from('lottery_entries')
          .select('*')
          .eq('lottery_id', input.id)
          .eq('status', 'ACTIVE');
        
        if (entriesError) throw new Error(entriesError.message);
        if (!entries || entries.length === 0) throw new Error('No entries found');

        const winners: any[] = [];
        const winnerCount = Math.min(input.winnerCount, entries.length);
        const shuffled = [...entries].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < winnerCount; i++) {
          winners.push(shuffled[i]);
        }

        for (const winner of winners) {
          const { error: updateError } = await supabase
            .from('lottery_entries')
            .update({
              is_winning: true,
              prize_rank: winners.indexOf(winner) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', winner.id);
          
          if (updateError) throw new Error(updateError.message);
        }

        const { error: statusError } = await supabase
          .from('lotteries')
          .update({
            status: 'COMPLETED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.id);
        
        if (statusError) throw new Error(statusError.message);

        await supabase
          .from('audit_logs')
          .insert({
            user_id: ctx.user?.id,
            action: 'LOTTERY_DRAW',
            resource: 'lotteries',
            resource_id: input.id,
            description: 'Lottery draw completed',
            new_data: {
              winners: winners.map(w => ({ id: w.id, user_id: w.user_id })),
              winnerCount,
            },
            created_at: new Date().toISOString(),
          });

        return {
          success: true,
          message: 'Draw completed successfully',
          winners: winners.map(w => ({
            id: w.id,
            userId: w.user_id,
            rank: winners.indexOf(w) + 1,
          })),
        };
      }),
  }),

  // 转售市场管理
  resales: router({
    list: protectedProcedure
      .input(z.object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let query = supabase
          .from('resales')
          .select('*, seller:users!resales_seller_id_fkey(*), buyer:users!resales_buyer_id_fkey(*), prize:prizes(*, lottery:lotteries(*))', { count: 'exact' });
        
        if (input.status) {
          query = query.eq('status', input.status);
        }
        
        query = query.order('created_at', { ascending: false });
        
        return await paginatedQuery(query, { page: input.page, pageSize: input.pageSize });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from('resales')
          .select('*, seller:users!resales_seller_id_fkey(*), buyer:users!resales_buyer_id_fkey(*), prize:prizes(*, lottery:lotteries(*))')
          .eq('id', input.id)
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(['ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED']),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await supabase
          .from('resales')
          .update({
            status: input.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),
  }),

  // 晒单审核
  showoffs: router({
    list: protectedProcedure
      .input(z.object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let query = supabase
          .from('showoffs')
          .select('*, user:users(*), prize:prizes(*, lottery:lotteries(*))', { count: 'exact' });
        
        if (input.status) {
          query = query.eq('status', input.status);
        }
        
        query = query.order('created_at', { ascending: false });
        
        return await paginatedQuery(query, { page: input.page, pageSize: input.pageSize });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from('showoffs')
          .select('*, user:users(*), prize:prizes(*, lottery:lotteries(*))')
          .eq('id', input.id)
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    approve: protectedProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(['APPROVED', 'REJECTED']),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await supabase
          .from('showoffs')
          .update({
            status: input.status,
            admin_notes: input.adminNotes,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),
  }),

  // 订单管理
  orders: router({
    list: protectedProcedure
      .input(z.object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        status: z.string().optional(),
        userId: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let query = supabase
          .from('tickets')
          .select('*, lottery:lotteries(*), user:users(*)', { count: 'exact' });
        
        if (input.userId) {
          query = query.eq('user_id', input.userId);
        }
        
        query = query.order('created_at', { ascending: false });
        
        return await paginatedQuery(query, { page: input.page, pageSize: input.pageSize });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from('tickets')
          .select('*, lottery:lotteries(*), user:users(*)')
          .eq('id', input.id)
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),
  }),

  // 充值审核
  deposits: router({
    list: protectedProcedure
      .input(z.object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let query = supabase
          .from('deposit_requests')
          .select('*, user:users(*)', { count: 'exact' });
        
        if (input.status) {
          query = query.eq('status', input.status);
        }
        
        query = query.order('created_at', { ascending: false });
        
        return await paginatedQuery(query, { page: input.page, pageSize: input.pageSize });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from('deposit_requests')
          .select('*, user:users(*)')
          .eq('id', input.id)
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    review: protectedProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(['APPROVED', 'REJECTED']),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await supabase
          .from('deposit_requests')
          .update({
            status: input.status,
            admin_note: input.adminNote,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        
        // 如果审核通过，更新用户余额
        if (input.status === 'APPROVED' && data) {
          const { data: user } = await supabase
            .from('users')
            .select('balance')
            .eq('id', data.user_id)
            .single();
          
          if (user) {
            await supabase
              .from('users')
              .update({
                balance: (user.balance || 0) + (data.amount || 0),
                updated_at: new Date().toISOString(),
              })
              .eq('id', data.user_id);
          }
        }
        
        return data;
      }),
  }),

  // 提现审核
  withdrawals: router({
    list: protectedProcedure
      .input(z.object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let query = supabase
          .from('withdrawal_requests')
          .select('*, user:users(*)', { count: 'exact' });
        
        if (input.status) {
          query = query.eq('status', input.status);
        }
        
        query = query.order('created_at', { ascending: false });
        
        return await paginatedQuery(query, { page: input.page, pageSize: input.pageSize });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from('withdrawal_requests')
          .select('*, user:users(*)')
          .eq('id', input.id)
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    review: protectedProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(['PROCESSING', 'COMPLETED', 'REJECTED']),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await supabase
          .from('withdrawal_requests')
          .update({
            status: input.status,
            admin_note: input.adminNote,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),
  }),

  // 发货管理
  shipping: router({
    list: protectedProcedure
      .input(z.object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let query = supabase
          .from('shipping_requests')
          .select('*, user:users(*), prize:prizes(*, lottery:lotteries(*))', { count: 'exact' });
        
        if (input.status) {
          query = query.eq('status', input.status);
        }
        
        query = query.order('requested_at', { ascending: false });
        
        return await paginatedQuery(query, { page: input.page, pageSize: input.pageSize });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from('shipping_requests')
          .select('*, user:users(*), prize:prizes(*, lottery:lotteries(*))')
          .eq('id', input.id)
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    updateShipping: protectedProcedure
      .input(z.object({
        id: z.string(),
        trackingNumber: z.string().optional(),
        shippingCompany: z.string().optional(),
        status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        const dbUpdateData: any = {
          updated_at: new Date().toISOString(),
        };
        
        if (updateData.trackingNumber) dbUpdateData.tracking_number = updateData.trackingNumber;
        if (updateData.shippingCompany) dbUpdateData.shipping_company = updateData.shippingCompany;
        if (updateData.status) {
          dbUpdateData.status = updateData.status;
          if (updateData.status === 'SHIPPED') {
            dbUpdateData.shipped_at = new Date().toISOString();
          }
        }
        
        const { data, error } = await supabase
          .from('shipping_requests')
          .update(dbUpdateData)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),
  }),

  // 支付配置
  paymentConfigs: router({
    list: protectedProcedure.query(async () => {
      const { data, error } = await supabase
        .from('payment_configs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw new Error(error.message);
      return data || [];
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from('payment_configs')
          .select('*')
          .eq('id', input.id)
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    create: protectedProcedure
      .input(z.object({
        payment_method: z.string(),
        is_enabled: z.boolean(),
        config: z.any(),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await supabase
          .from('payment_configs')
          .insert({
            ...input,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.string(),
        payment_method: z.string().optional(),
        is_enabled: z.boolean().optional(),
        config: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        const { data, error } = await supabase
          .from('payment_configs')
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from('payment_configs')
          .delete()
          .eq('id', input.id);
        
        if (error) throw new Error(error.message);
        return { success: true };
      }),
  }),

  // 审计日志
  auditLogs: router({
    list: protectedProcedure
      .input(z.object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        action: z.string().optional(),
        resource: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let query = supabase.from('audit_logs').select('*', { count: 'exact' });
        
        if (input.action) {
          query = query.eq('action', input.action);
        }
        
        if (input.resource) {
          query = query.eq('resource', input.resource);
        }
        
        query = query.order('created_at', { ascending: false });
        
        return await paginatedQuery(query, { page: input.page, pageSize: input.pageSize });
      }),
  }),

  // 数据统计
  stats: router({
    overview: protectedProcedure.query(async () => {
      const [usersResult, lotteriesResult, ticketsResult, prizesResult] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('lotteries').select('*', { count: 'exact', head: true }),
        supabase.from('tickets').select('*', { count: 'exact', head: true }),
        supabase.from('prizes').select('*', { count: 'exact', head: true }),
      ]);

      // 获取待审核数据
      const [pendingDeposits, pendingWithdrawals, pendingShipping] = await Promise.all([
        supabase.from('deposit_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('shipping_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      ]);

      // 获取财务统计
      const { data: approvedDeposits } = await supabase
        .from('deposit_requests')
        .select('amount')
        .eq('status', 'APPROVED');
      
      const { data: completedWithdrawals } = await supabase
        .from('withdrawal_requests')
        .select('amount')
        .eq('status', 'COMPLETED');

      const totalRevenue = approvedDeposits?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
      const totalPayout = completedWithdrawals?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;

      return {
        totalUsers: usersResult.count || 0,
        totalLotteries: lotteriesResult.count || 0,
        totalTickets: ticketsResult.count || 0,
        totalPrizes: prizesResult.count || 0,
        pendingDeposits: pendingDeposits.count || 0,
        pendingWithdrawals: pendingWithdrawals.count || 0,
        pendingShipping: pendingShipping.count || 0,
        totalRevenue,
        totalPayout,
        netRevenue: totalRevenue - totalPayout,
      };
    }),

    recent: protectedProcedure.query(async () => {
      // 获取最近的用户
      const { data: recentUsers } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // 获取最近的订单
      const { data: recentTickets } = await supabase
        .from('tickets')
        .select('*, lottery:lotteries(*), user:users(*)')
        .order('created_at', { ascending: false })
        .limit(5);

      // 获取最近的中奖
      const { data: recentPrizes } = await supabase
        .from('prizes')
        .select('*, lottery:lotteries(*), user:users(*)')
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        recentUsers: recentUsers || [],
        recentTickets: recentTickets || [],
        recentPrizes: recentPrizes || [],
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
