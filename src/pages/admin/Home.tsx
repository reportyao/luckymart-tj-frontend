import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Package, BarChart, DollarSign, CreditCard, Settings, Truck, ShoppingCart, Image, RefreshCw } from "lucide-react";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {APP_LOGO && <img src={APP_LOGO} alt="Logo" className="h-8" />}
            <h1 className="text-xl font-bold">{APP_TITLE}</h1>
          </div>
          {isAuthenticated && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Welcome, {user?.name}</span>
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard">Dashboard</a>
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-6 max-w-2xl mx-auto px-4">
          <h2 className="text-4xl font-bold">LuckyMart 管理后台</h2>
          <p className="text-xl text-muted-foreground">
            管理用户、夺宝商品和订单
          </p>
          
          {!isAuthenticated ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">请登录以访问管理功能</p>
              <Button size="lg" asChild>
                <a href={getLoginUrl()}>登录</a>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3 mt-8">
              <Button size="lg" variant="outline" asChild>
                <a href="/dashboard" className="flex flex-col items-center gap-2 h-auto py-6">
                  <BarChart className="h-8 w-8" />
                  <span>仪表板</span>
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/users" className="flex flex-col items-center gap-2 h-auto py-6">
                  <Users className="h-8 w-8" />
                  <span>用户管理</span>
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/lotteries" className="flex flex-col items-center gap-2 h-auto py-6">
                  <Package className="h-8 w-8" />
                  <span>夺宝管理</span>
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/deposit-review" className="flex flex-col items-center gap-2 h-auto py-6">
                  <DollarSign className="h-8 w-8" />
                  <span>充值审核</span>
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/withdrawal-review" className="flex flex-col items-center gap-2 h-auto py-6">
                  <CreditCard className="h-8 w-8" />
                  <span>提现审核</span>
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/payment-config" className="flex flex-col items-center gap-2 h-auto py-6">
                  <Settings className="h-8 w-8" />
                  <span>支付配置</span>
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/shipping-management" className="flex flex-col items-center gap-2 h-auto py-6">
                  <Truck className="h-8 w-8" />
                  <span>发货管理</span>
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/orders" className="flex flex-col items-center gap-2 h-auto py-6">
                  <ShoppingCart className="h-8 w-8" />
                  <span>订单管理</span>
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/showoff-review" className="flex flex-col items-center gap-2 h-auto py-6">
                  <Image className="h-8 w-8" />
                  <span>晒单审核</span>
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/resale-management" className="flex flex-col items-center gap-2 h-auto py-6">
                  <RefreshCw className="h-8 w-8" />
                  <span>转售管理</span>
                </a>
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
