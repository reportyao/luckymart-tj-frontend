# Database Mapping & Architecture Document

> **Last Updated**: 2025-12-16
> **Project**: LuckyMart Tajikistan
> **Database**: Supabase PostgreSQL

## Executive Summary

This document provides a comprehensive mapping of database tables, their relationships, and corresponding Edge Functions/API endpoints. It identifies discrepancies, deprecated tables, and recommended fixes.

---

## Table Status Overview

### ✅ Active & Verified Tables

| Table Name | Purpose | Status | Column Count |
|-----------|---------|--------|--------------|
| `users` | User profiles and stats | ✅ Active | 28 |
| `user_sessions` | Custom session management | ✅ Active | 10 |
| `wallets` | Multi-currency wallet system | ✅ Active | 11 |
| `wallet_transactions` | Wallet transaction logs | ✅ Active | 13 |
| `lotteries` | Lottery definitions | ✅ Active | 32 |
| `tickets` | Individual lottery tickets | ✅ Active | 7 |
| `lottery_entries` | Lottery participation records | ✅ Active | 13 |
| `orders` | Purchase orders | ✅ Active | 17 |
| `transactions` | Financial transaction logs | ✅ Active | 13 |
| `commissions` | Referral commissions | ✅ Active | 14 |
| `showoffs` | User prize showcases | ✅ Active | 14 |
| `likes` | Showoff post likes | ✅ Active | 4 |
| `notifications` | User notifications | ✅ Active | 14 |
| `resales` | Resale marketplace items | ✅ Active | ~10 |

### ⚠️ Empty Tables (Exist but No Data)

| Table Name | Purpose | Status | Action Needed |
|-----------|---------|--------|---------------|
| `prizes` | Prize records for winners | ⚠️ Empty | Verify prize creation logic |
| `lottery_results` | Historical lottery results | ⚠️ Empty | Check auto-draw function |
| `exchange_records` | Balance exchange history | ⚠️ Empty | Verify exchange function |
| `shipping` | Shipping information | ⚠️ Empty | Verify shipping workflow |
| `resale_items` | Legacy resale table | ⚠️ Empty | **DEPRECATED** - Use `resales` |

### ❌ Missing Tables

| Table Name | Expected Purpose | Status | Impact |
|-----------|------------------|--------|--------|
| `resale_listings` | Alternative resale table | ❌ Missing | **Not used** - consolidated to `resales` |
| `deposits` | Deposit requests | ❌ Missing | **CRITICAL** - Need to create or verify actual table name |
| `withdrawals` | Withdrawal requests | ❌ Missing | **CRITICAL** - Need to create or verify actual table name |
| `payment_configs` | Payment configuration | ❌ Missing | Check if using different table name |
| `shipping_addresses` | User shipping addresses | ❌ Missing | May be embedded in other tables |
| `admins` | Admin user accounts | ❌ Missing | Check authentication method |
| `admin_logs` | Admin action logs | ❌ Missing | Consider implementing for audit |
| `permissions` | Role-based permissions | ❌ Missing | Check authorization logic |
| `roles` | User/admin roles | ❌ Missing | Check authorization logic |

---

## Core Table Structures

### 1. Users & Authentication

#### `users` Table (28 columns)
```
Core Fields:
- id, telegram_id, telegram_username
- first_name, last_name, avatar_url
- language_code, phone_number, email
- status, is_verified, kyc_level

Security:
- two_factor_enabled

Activity Tracking:
- last_login_at, last_active_at

Referral System:
- referral_code, referred_by_id, referrer_id
- referral_level, level, commission_rate

Statistics:
- total_spent, total_won, total_lotteries, winning_rate

Timestamps:
- created_at, updated_at, deleted_at
```

**⚠️ ISSUE**: No `balance` column - system uses `wallets` table instead ✅

#### `user_sessions` Table (10 columns)
```
- id, user_id, session_token
- device, ip_address, user_agent, location
- is_active, expires_at, created_at
```

**Usage**: Custom session management for Edge Functions
**Authentication Pattern**: `session_token` passed via headers

---

### 2. Wallet System

#### `wallets` Table (11 columns)
```
- id, user_id
- type (BALANCE, LUCKY_COIN, BONUS)
- currency (TJS, USD, etc.)
- balance, frozen_balance
- total_deposits, total_withdrawals
- version (for optimistic locking)
- created_at, updated_at
```

**Key Pattern**: Each user has multiple wallets (one per type+currency combination)

#### `wallet_transactions` Table (13 columns)
```
- id, wallet_id
- type (DEPOSIT, WITHDRAWAL, PURCHASE, EXCHANGE, COMMISSION, etc.)
- amount, balance_before, balance_after
- status, description
- related_order_id, related_lottery_id, reference_id
- processed_at, created_at
```

---

### 3. Lottery System

#### `lotteries` Table (32 columns)
```
Basic Info:
- id, period, title, description, image_url
- ticket_price, total_tickets, max_per_user, currency

I18n Fields:
- title_i18n, description_i18n, details_i18n
- specifications_i18n, material_i18n, name_i18n
- image_urls (JSONB array)

Status & Sales:
- status (UPCOMING, ACTIVE, SOLD_OUT, DRAWING, COMPLETED)
- sold_tickets, unlimited_purchase

Timing:
- start_time, end_time, draw_time, actual_draw_time

Drawing Data:
- winning_numbers, winning_ticket_number, winning_user_id
- vrf_seed, vrf_proof, vrf_timestamp
- draw_algorithm_data (JSONB - fairness verification)

Timestamps:
- created_at, updated_at
```

**⚠️ ISSUE**: Foreign key `winning_user_id` -> `users` not properly configured

#### `tickets` Table (7 columns)
```
- id, user_id, lottery_id, order_id
- ticket_number (unique 7-digit code)
- is_winning
- created_at
```

**Usage**: Primary table for lottery participation tracking

#### `lottery_entries` Table (13 columns)
```
- id, user_id, lottery_id, order_id
- numbers (participation code)
- is_winning, prize_amount, prize_rank
- status, is_from_market, original_owner
- created_at, updated_at
```

**⚠️ REDUNDANCY**: Both `tickets` and `lottery_entries` exist
**Current Usage**: 
- `lottery_entries` used by `lottery-purchase` Edge Function
- `tickets` used by frontend `LotteryResultPage`
- **RECOMMENDATION**: Consolidate to one table or clarify usage pattern

---

### 4. Order & Transaction System

#### `orders` Table (17 columns)
```
- id, user_id, order_number
- type (LOTTERY, DEPOSIT, WITHDRAW, MARKET)
- total_amount, currency, payment_method
- lottery_id, quantity, selected_numbers
- status (PENDING, PAID, CANCELLED, EXPIRED)
- payment_id, payment_data, paid_at
- created_at, updated_at, expired_at
```

#### `transactions` Table (13 columns)
```
- id, user_id
- type (DEPOSIT, WITHDRAW, PURCHASE, COMMISSION, EXCHANGE, etc.)
- amount, currency, status
- related_id, related_type
- balance_before, balance_after, notes
- created_at, updated_at
```

**⚠️ REDUNDANCY**: Similar to `wallet_transactions`
**RECOMMENDATION**: Clarify which table to use for different transaction types

---

### 5. Resale Marketplace

#### `resales` Table (✅ ACTIVE)
```
Estimated columns based on usage:
- id, seller_id, buyer_id
- lottery_id, ticket_id
- resale_price, original_price
- status (ACTIVE, SOLD, CANCELLED)
- created_at, updated_at, sold_at
```

#### `resale_items` Table (⚠️ DEPRECATED)
```
- id, seller_id, lottery_id
- is_active
- created_at, updated_at
```

**⚠️ ISSUE**: Missing critical columns (price, status, etc.)
**ACTION**: All Edge Functions updated to use `resales` table

---

### 6. Prize & Shipping

#### `prizes` Table (⚠️ EMPTY)
```
Expected structure:
- id, user_id, lottery_id
- prize_type, prize_value
- status (PENDING, SHIPPING, DELIVERED, RESELLING, RESOLD)
- created_at, won_at
```

**⚠️ ISSUE**: Table empty, verify prize creation in auto-draw function

#### `shipping` Table (⚠️ EMPTY)
```
Expected structure:
- id, prize_id, user_id
- recipient_name, phone, address
- tracking_number, shipping_method
- status, shipped_at, delivered_at
```

---

### 7. Social Features

#### `showoffs` Table (14 columns)
```
- id, user_id, lottery_id, prize_id
- content, images (JSONB)
- likes_count, comments_count
- status (PENDING, APPROVED, REJECTED)
- admin_note, reviewed_at
- reward_coins
- created_at, updated_at
```

#### `likes` Table (4 columns)
```
- id, post_id (references showoffs.id)
- user_id
- created_at
```

---

### 8. Referral & Commission

#### `commissions` Table (14 columns)
```
- id, user_id, from_user_id
- level, type
- amount, rate, source_amount
- related_order_id, related_lottery_id
- status, paid_at
- created_at, updated_at
```

---

## Edge Functions Mapping

### Authentication & Session

| Function | Table(s) Used | Purpose | Status |
|----------|---------------|---------|--------|
| `auth-telegram` | `users`, `user_sessions` | Telegram WebApp auth | ✅ |
| `validate-session` | `user_sessions`, `users` | Session validation | ✅ |

### Lottery Operations

| Function | Table(s) Used | Purpose | Status |
|----------|---------------|---------|--------|
| `lottery-purchase` | `users`, `user_sessions`, `lotteries`, `wallets`, `wallet_transactions`, `orders`, `lottery_entries`, `commissions` | Purchase lottery tickets | ✅ Fixed |
| `auto-lottery-draw` | `lottery_entries`, `lotteries`, `lottery_results`, `prizes`, `notifications` | Auto draw when sold out | ⚠️ Uses `lottery_entries` |
| `draw-lottery` | `lotteries`, `tickets` | Manual draw | ⚠️ May conflict with auto-draw |

**⚠️ ISSUE**: `auto-lottery-draw` uses `lottery_entries`, but `LotteryResultPage` expects `tickets`

### Wallet Operations

| Function | Table(s) Used | Purpose | Status |
|----------|---------------|---------|--------|
| `exchange-balance` | `user_sessions`, `users`, `wallets`, `exchange_records`, `wallet_transactions` | TJS -> Lucky Coins | ✅ Fixed |
| `get-wallet-balance` | `wallets` | Get user wallet | ✅ |

### Resale Market

| Function | Table(s) Used | Purpose | Status |
|----------|---------------|---------|--------|
| `create-resale` | `user_sessions`, `users`, `prizes`, `resales` | Create resale listing | ✅ Fixed |
| `list-resale-items` | `resales`, `lotteries`, `users` | Get market listings | ✅ Fixed |
| `purchase-resale` | `user_sessions`, `users`, `resales`, `prizes`, `wallets`, `wallet_transactions` | Buy resale item | ✅ Fixed |
| `cancel-resale` | `user_sessions`, `users`, `resales`, `prizes` | Cancel listing | ✅ Fixed |

### Prize Management

| Function | Table(s) Used | Purpose | Status |
|----------|---------------|---------|--------|
| `get-my-prizes` | `user_sessions`, `users`, `prizes`, `lotteries`, `shipping`, `resales` | Get user's prizes | ✅ |
| `request-shipping` | `user_sessions`, `users`, `prizes`, `shipping` | Request prize shipping | ⚠️ Verify shipping table |

### Referral System

| Function | Table(s) Used | Purpose | Status |
|----------|---------------|---------|--------|
| `get-user-referral-stats` | `user_sessions`, `users`, `commissions` | Get referral stats | ✅ |
| `get-invited-users` | `user_sessions`, `users` | Get invited user list | ✅ |
| `activate-first-deposit-bonus` | `user_sessions`, `users`, `wallets` | Activate bonus | ✅ |

### Deposit & Withdrawal

| Function | Table(s) Used | Purpose | Status |
|----------|---------------|---------|--------|
| `deposit-request` | `users`, `orders`, `deposits`? | Submit deposit | ⚠️ Missing `deposits` table |
| `withdrawal-request` | `users`, `wallets`, `withdrawals`? | Submit withdrawal | ⚠️ Missing `withdrawals` table |
| `get-payment-config` | `payment_configs`? | Get payment info | ⚠️ Missing table |

---

## Critical Issues & Recommendations

### 🔴 HIGH PRIORITY

1. **Deposits/Withdrawals Tables Missing**
   - Functions reference these tables but they don't exist
   - **Action**: Check actual table names or create tables

2. **Tickets vs Lottery_Entries Redundancy**
   - Two tables tracking same data
   - **Action**: Consolidate or document clear usage pattern
   - **Current Fix**: Frontend supports both tables

3. **Prizes Table Empty**
   - No prizes being created after draws
   - **Action**: Verify `auto-lottery-draw` prize creation logic

4. **Foreign Key Issues**
   - `lotteries.winning_user_id` -> `users` not properly linked
   - `prizes.lottery_id` -> `lotteries` not properly linked
   - **Action**: Add foreign key constraints in database

### 🟡 MEDIUM PRIORITY

5. **Resale_Items Deprecated**
   - Old table structure incompatible
   - **Action**: ✅ Fixed - all functions use `resales` now

6. **Transaction vs Wallet_Transactions**
   - Unclear which to use when
   - **Action**: Document usage pattern

7. **Admin Tables Missing**
   - No proper admin user management
   - **Action**: Implement admin authentication system

### 🟢 LOW PRIORITY

8. **Shipping_Addresses Table**
   - May be embedded in shipping records
   - **Action**: Verify if needed

9. **Audit Logging**
   - No admin_logs table
   - **Action**: Consider implementing for compliance

---

## Usage Guidelines

### For Edge Functions
1. Always use `user_sessions` table for authentication (not Supabase Auth)
2. Pass `session_token` in request headers
3. Use `wallets` table for balance operations (not `users.balance`)
4. Use `resales` table for marketplace (not `resale_items`)
5. Log all transactions in `wallet_transactions`

### For Frontend
1. Lottery results: Check both `tickets` and `lottery_entries` tables
2. User balance: Fetch from `wallets` table filtered by type
3. Market listings: Use `list-resale-items` Edge Function
4. Prizes: Use `get-my-prizes` Edge Function with proper joins

### For Admin Backend
1. Use service_role_key to bypass RLS
2. Query `resales` table for marketplace management
3. Check `commissions` table for referral tracking
4. Monitor `wallet_transactions` for financial audit

---

## Next Steps

1. ✅ Update all Edge Functions to use correct tables
2. ⚠️ Create missing deposit/withdrawal tables or verify names
3. ⚠️ Consolidate tickets/lottery_entries usage
4. ⚠️ Verify prize creation logic
5. ⚠️ Add missing foreign key constraints
6. ⚠️ Document transaction vs wallet_transactions usage
7. ⚠️ Implement admin authentication system

---

*This document should be updated whenever database schema changes occur.*
