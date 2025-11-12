import { useState } from "react";
import { useParams, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Award, ShoppingCart } from "lucide-react";

export default function UserDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const userId = params.id!;

  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [balanceType, setBalanceType] = useState<'BALANCE' | 'LOTTERY_COINS'>('BALANCE');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const { data: user, isLoading, refetch } = trpc.users.getById.useQuery({ id: userId });
  const { data: stats } = trpc.users.getStats.useQuery({ id: userId });

  const adjustBalanceMutation = trpc.users.adjustBalance.useMutation({
    onSuccess: () => {
      toast.success("余额调整成功");
      setShowBalanceDialog(false);
      setAmount('');
      setReason('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateStatusMutation = trpc.users.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("状态更新成功");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAdjustBalance = () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum === 0) {
      toast.error("请输入有效金额");
      return;
    }
    if (!reason.trim()) {
      toast.error("请填写调整原因");
      return;
    }

    adjustBalanceMutation.mutate({
      userId,
      amount: amountNum,
      type: balanceType,
      reason,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      ACTIVE: "default",
      SUSPENDED: "secondary",
      BANNED: "destructive",
    };
    const labels: Record<string, string> = {
      ACTIVE: "活跃",
      SUSPENDED: "暂停",
      BANNED: "封禁",
    };
    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">用户不存在</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/users")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">用户详情</h1>
            <p className="text-muted-foreground mt-2">
              查看和管理用户信息
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Telegram ID</div>
                  <div className="font-mono">{user.telegram_id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">用户名</div>
                  <div>{user.telegram_username || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">姓名</div>
                  <div>{user.first_name || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">邀请码</div>
                  <div className="font-mono">{user.referral_code}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">状态</div>
                  <div>{getStatusBadge(user.status)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">注册时间</div>
                  <div>{new Date(user.created_at).toLocaleString()}</div>
                </div>
              </div>

              <div className="pt-4">
                <Label>修改状态</Label>
                <Select
                  value={user.status}
                  onValueChange={(value) => updateStatusMutation.mutate({ id: userId, status: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">活跃</SelectItem>
                    <SelectItem value="SUSPENDED">暂停</SelectItem>
                    <SelectItem value="BANNED">封禁</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 余额信息 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>余额信息</CardTitle>
              <Button size="sm" onClick={() => setShowBalanceDialog(true)}>
                调整余额
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <Wallet className="h-5 w-5" />
                    <span className="text-sm font-medium">余额</span>
                  </div>
                  <div className="text-2xl font-bold">{user.balance || 0} TJS</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2 text-purple-600 mb-2">
                    <Award className="h-5 w-5" />
                    <span className="text-sm font-medium">夺宝币</span>
                  </div>
                  <div className="text-2xl font-bold">{user.lottery_coins || 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 统计信息 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">购买次数</div>
                  <div className="text-2xl font-bold">{stats?.totalTickets || 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <Award className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">中奖次数</div>
                  <div className="text-2xl font-bold">{stats?.totalPrizes || 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-50 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">总充值</div>
                  <div className="text-2xl font-bold">{stats?.totalDeposit || 0} TJS</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-50 rounded-lg">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">总提现</div>
                  <div className="text-2xl font-bold">{stats?.totalWithdrawal || 0} TJS</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 余额调整对话框 */}
      <Dialog open={showBalanceDialog} onOpenChange={setShowBalanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>调整余额</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>调整类型</Label>
              <Select value={balanceType} onValueChange={(value: any) => setBalanceType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BALANCE">余额</SelectItem>
                  <SelectItem value="LOTTERY_COINS">夺宝币</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>调整金额 (正数增加，负数减少)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="例如: 100 或 -50"
              />
            </div>

            <div className="space-y-2">
              <Label>调整原因</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请填写调整原因..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBalanceDialog(false)}>
              取消
            </Button>
            <Button onClick={handleAdjustBalance} disabled={adjustBalanceMutation.isPending}>
              {adjustBalanceMutation.isPending ? "提交中..." : "确认"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
