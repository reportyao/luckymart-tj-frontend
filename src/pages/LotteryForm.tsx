import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function LotteryForm() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const lotteryId = params.id;
  const isEdit = !!lotteryId;

  const [formData, setFormData] = useState({
    period: "",
    title: "",
    description: "",
    ticket_price: "",
    total_tickets: "",
    max_per_user: "",
    currency: "TJS",
    start_time: "",
    end_time: "",
    draw_time: "",
  });

  const { data: lottery, isLoading } = trpc.lotteries.getById.useQuery(
    { id: lotteryId! },
    { enabled: isEdit }
  );

  const createMutation = trpc.lotteries.create.useMutation({
    onSuccess: () => {
      toast.success("创建成功");
      setLocation("/lotteries");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.lotteries.update.useMutation({
    onSuccess: () => {
      toast.success("更新成功");
      setLocation("/lotteries");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (lottery) {
      setFormData({
        period: lottery.period,
        title: lottery.title,
        description: lottery.description || "",
        ticket_price: lottery.ticket_price.toString(),
        total_tickets: lottery.total_tickets.toString(),
        max_per_user: lottery.max_per_user.toString(),
        currency: lottery.currency,
        start_time: lottery.start_time ? new Date(lottery.start_time).toISOString().slice(0, 16) : "",
        end_time: lottery.end_time ? new Date(lottery.end_time).toISOString().slice(0, 16) : "",
        draw_time: lottery.draw_time ? new Date(lottery.draw_time).toISOString().slice(0, 16) : "",
      });
    }
  }, [lottery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      period: formData.period,
      title: formData.title,
      description: formData.description,
      ticket_price: parseFloat(formData.ticket_price),
      total_tickets: parseInt(formData.total_tickets),
      max_per_user: parseInt(formData.max_per_user),
      currency: formData.currency,
      start_time: new Date(formData.start_time).toISOString(),
      end_time: new Date(formData.end_time).toISOString(),
      draw_time: new Date(formData.draw_time).toISOString(),
    };

    if (isEdit) {
      updateMutation.mutate({ id: lotteryId!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isEdit && isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/lotteries")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isEdit ? "编辑夺宝" : "创建夺宝"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isEdit ? "修改夺宝信息" : "创建新的夺宝活动"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="period">期号 *</Label>
                  <Input
                    id="period"
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                    placeholder="例如: 20250107001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">货币</Label>
                  <Input
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    placeholder="TJS"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">标题 *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="例如: iPhone 15 Pro Max 256GB"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="商品详细描述..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ticket_price">票价 *</Label>
                  <Input
                    id="ticket_price"
                    type="number"
                    step="0.01"
                    value={formData.ticket_price}
                    onChange={(e) => setFormData({ ...formData, ticket_price: e.target.value })}
                    placeholder="10.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_tickets">总票数 *</Label>
                  <Input
                    id="total_tickets"
                    type="number"
                    value={formData.total_tickets}
                    onChange={(e) => setFormData({ ...formData, total_tickets: e.target.value })}
                    placeholder="1000"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_per_user">每人限购 *</Label>
                  <Input
                    id="max_per_user"
                    type="number"
                    value={formData.max_per_user}
                    onChange={(e) => setFormData({ ...formData, max_per_user: e.target.value })}
                    placeholder="10"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">开始时间 *</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">结束时间 *</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="draw_time">开奖时间 *</Label>
                  <Input
                    id="draw_time"
                    type="datetime-local"
                    value={formData.draw_time}
                    onChange={(e) => setFormData({ ...formData, draw_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => setLocation("/lotteries")}>
                  取消
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? "提交中..." : isEdit ? "保存" : "创建"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
}
