import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Plus, ChevronLeft, ChevronRight, Edit, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function Lotteries() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [drawDialogOpen, setDrawDialogOpen] = useState(false);
  const [selectedLotteryId, setSelectedLotteryId] = useState<string | null>(null);
  const [winnerCount, setWinnerCount] = useState(1);

  const { data, isLoading, refetch } = trpc.lotteries.list.useQuery({
    page,
    pageSize: 20,
    status,
  });

  const updateStatusMutation = trpc.lotteries.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const drawMutation = trpc.lotteries.draw.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setDrawDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleStatusChange = (lotteryId: string, newStatus: string) => {
    updateStatusMutation.mutate({ id: lotteryId, status: newStatus as any });
  };

  const handleDraw = (lotteryId: string) => {
    setSelectedLotteryId(lotteryId);
    setDrawDialogOpen(true);
  };

  const confirmDraw = () => {
    if (selectedLotteryId) {
      drawMutation.mutate({ id: selectedLotteryId, winnerCount });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDING: "outline",
      ACTIVE: "default",
      COMPLETED: "secondary",
      CANCELLED: "destructive",
    };
    const labels: Record<string, string> = {
      PENDING: "待开始",
      ACTIVE: "进行中",
      COMPLETED: "已完成",
      CANCELLED: "已取消",
    };
    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">夺宝管理</h1>
            <p className="text-muted-foreground mt-2">
              管理所有夺宝商品和活动
            </p>
          </div>
          <Button onClick={() => setLocation("/lotteries/new")}>
            <Plus className="h-4 w-4 mr-2" />
            创建夺宝
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>筛选</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="PENDING">待开始</SelectItem>
                <SelectItem value="ACTIVE">进行中</SelectItem>
                <SelectItem value="COMPLETED">已完成</SelectItem>
                <SelectItem value="CANCELLED">已取消</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>夺宝列表</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>期号</TableHead>
                      <TableHead>标题</TableHead>
                      <TableHead>票价</TableHead>
                      <TableHead>总票数</TableHead>
                      <TableHead>已售</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>开奖时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.map((lottery: any) => (
                      <TableRow key={lottery.id}>
                        <TableCell className="font-mono">{lottery.period}</TableCell>
                        <TableCell className="font-medium">{lottery.title}</TableCell>
                        <TableCell>{lottery.ticket_price} {lottery.currency}</TableCell>
                        <TableCell>{lottery.total_tickets}</TableCell>
                        <TableCell>{lottery.sold_tickets}</TableCell>
                        <TableCell>{getStatusBadge(lottery.status)}</TableCell>
                        <TableCell>{new Date(lottery.draw_time).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/lotteries/${lottery.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {lottery.status === 'ACTIVE' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDraw(lottery.id)}
                              >
                                <Zap className="h-4 w-4 mr-1" />
                                开奖
                              </Button>
                            )}
                            <Select
                              value={lottery.status}
                              onValueChange={(value) => handleStatusChange(lottery.id, value)}
                            >
                              <SelectTrigger className="w-[100px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PENDING">待开始</SelectItem>
                                <SelectItem value="ACTIVE">进行中</SelectItem>
                                <SelectItem value="COMPLETED">已完成</SelectItem>
                                <SelectItem value="CANCELLED">已取消</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    显示 {((page - 1) * 20) + 1} - {Math.min(page * 20, data?.total || 0)} 条,
                    共 {data?.total || 0} 条
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= (data?.totalPages || 1)}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={drawDialogOpen} onOpenChange={setDrawDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>开奖</DialogTitle>
              <DialogDescription>
                请输入中奖人数，系统将随机选出中奖者
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">中奖人数</label>
                <Input
                  type="number"
                  min="1"
                  value={winnerCount}
                  onChange={(e) => setWinnerCount(parseInt(e.target.value) || 1)}
                  className="mt-2"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDrawDialogOpen(false)}
                >
                  取消
                </Button>
                <Button
                  onClick={confirmDraw}
                  disabled={drawMutation.isPending}
                >
                  {drawMutation.isPending ? '开奖中...' : '确认开奖'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
