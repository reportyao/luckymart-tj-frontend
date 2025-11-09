import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Users, Package, ShoppingCart, Award, DollarSign, AlertCircle, TrendingUp, Clock } from "lucide-react";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { data: stats, isLoading } = trpc.stats.overview.useQuery();
  const { data: recent } = trpc.stats.recent.useQuery();

  if (loading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const statCards = [
    {
      title: "总用户数",
      value: stats?.totalUsers || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "总夺宝商品",
      value: stats?.totalLotteries || 0,
      icon: Package,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "总购买次数",
      value: stats?.totalTickets || 0,
      icon: ShoppingCart,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "总中奖次数",
      value: stats?.totalPrizes || 0,
      icon: Award,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
  ];

  const pendingCards = [
    {
      title: "待审核充值",
      value: stats?.pendingDeposits || 0,
      link: "/deposit-review",
      icon: AlertCircle,
      color: "text-orange-600",
    },
    {
      title: "待审核提现",
      value: stats?.pendingWithdrawals || 0,
      link: "/withdrawal-review",
      icon: AlertCircle,
      color: "text-red-600",
    },
    {
      title: "待发货订单",
      value: stats?.pendingShipping || 0,
      link: "/shipping-management",
      icon: Clock,
      color: "text-blue-600",
    },
  ];

  const financeCards = [
    {
      title: "总充值金额",
      value: `${stats?.totalRevenue || 0} TJS`,
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "总提现金额",
      value: `${stats?.totalPayout || 0} TJS`,
      icon: DollarSign,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "净收入",
      value: `${stats?.netRevenue || 0} TJS`,
      icon: DollarSign,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">仪表板</h1>
          <p className="text-muted-foreground mt-2">
            欢迎回来, {user?.name || '管理员'}
          </p>
        </div>

        {/* 核心统计 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 待处理事项 */}
        <div>
          <h2 className="text-xl font-bold mb-4">待处理事项</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {pendingCards.map((card) => {
              const Icon = card.icon;
              return (
                <a
                  key={card.title}
                  href={card.link}
                  className="block"
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{card.title}</p>
                          <p className="text-3xl font-bold mt-2">{card.value}</p>
                        </div>
                        <Icon className={`h-8 w-8 ${card.color}`} />
                      </div>
                    </CardContent>
                  </Card>
                </a>
              );
            })}
          </div>
        </div>

        {/* 财务统计 */}
        <div>
          <h2 className="text-xl font-bold mb-4">财务统计</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {financeCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {card.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${card.bgColor}`}>
                      <Icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{card.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* 最近活动 */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* 最近注册用户 */}
          <Card>
            <CardHeader>
              <CardTitle>最近注册用户</CardTitle>
            </CardHeader>
            <CardContent>
              {recent?.recentUsers && recent.recentUsers.length > 0 ? (
                <div className="space-y-3">
                  {recent.recentUsers.map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between p-2 hover:bg-accent rounded">
                      <div>
                        <p className="font-medium">{user.first_name || user.telegram_username || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">@{user.telegram_username || user.telegram_id}</p>
                      </div>
                      <Badge variant={user.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {user.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>
              )}
            </CardContent>
          </Card>

          {/* 最近中奖 */}
          <Card>
            <CardHeader>
              <CardTitle>最近中奖记录</CardTitle>
            </CardHeader>
            <CardContent>
              {recent?.recentPrizes && recent.recentPrizes.length > 0 ? (
                <div className="space-y-3">
                  {recent.recentPrizes.map((prize: any) => (
                    <div key={prize.id} className="flex items-center justify-between p-2 hover:bg-accent rounded">
                      <div>
                        <p className="font-medium">{prize.lottery?.title || '未知商品'}</p>
                        <p className="text-sm text-muted-foreground">
                          {prize.user?.first_name || prize.user?.telegram_username || 'Unknown'}
                        </p>
                      </div>
                      <Badge variant="default">
                        {prize.winning_code}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 快速操作 */}
        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <a
                href="/lotteries/new"
                className="flex items-center justify-center p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <Package className="h-5 w-5 mr-2" />
                创建新夺宝
              </a>
              <a
                href="/users"
                className="flex items-center justify-center p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <Users className="h-5 w-5 mr-2" />
                用户管理
              </a>
              <a
                href="/lotteries"
                className="flex items-center justify-center p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                夺宝管理
              </a>
              <a
                href="/payment-config"
                className="flex items-center justify-center p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <DollarSign className="h-5 w-5 mr-2" />
                支付配置
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
