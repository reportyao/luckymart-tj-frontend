import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";

export default function ResaleManagement() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("ACTIVE");
  const [selectedResale, setSelectedResale] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const { data, isLoading, refetch } = trpc.resales.list.useQuery({
    page,
    pageSize: 20,
    status: status === 'ALL' ? undefined : status,
  });

  const updateStatusMutation = trpc.resales.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("状态更新成功");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleViewDetail = (resale: any) => {
    setSelectedResale(resale);
    setShowDetailDialog(true);
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    updateStatusMutation.mutate({
      id,
      status: newStatus as any,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ACTIVE: "default",
      SOLD: "secondary",
      CANCELLED: "destructive",
      EXPIRED: "outline",
    };
    const labels: Record<string, string> = {
      ACTIVE: "在售",
      SOLD: "已售出",
      CANCELLED: "已取消",
      EXPIRED: "已过期",
    };
    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">转售市场管理</h1>
          <p className="text-muted-foreground mt-2">
            管理用户的中奖商品转售
          </p>
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
                <SelectItem value="ALL">全部状态</SelectItem>
                <SelectItem value="ACTIVE">在售</SelectItem>
                <SelectItem value="SOLD">已售出</SelectItem>
                <SelectItem value="CANCELLED">已取消</SelectItem>
                <SelectItem value="EXPIRED">已过期</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>转售列表</CardTitle>
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
                      <TableHead>卖家</TableHead>
                      <TableHead>夺宝商品</TableHead>
                      <TableHead>中奖码</TableHead>
                      <TableHead>转售价格</TableHead>
                      <TableHead>买家</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>发布时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.map((resale: any) => (
                      <TableRow key={resale.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{resale.seller?.first_name || resale.seller?.telegram_username || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">@{resale.seller?.telegram_username || resale.seller?.telegram_id}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{resale.prize?.lottery?.title || '未知商品'}</div>
                          <div className="text-xs text-muted-foreground">期号: {resale.prize?.lottery?.period}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {resale.prize?.winning_code || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {resale.price || 0} {resale.currency || 'TJS'}
                        </TableCell>
                        <TableCell>
                          {resale.buyer ? (
                            <div>
                              <div className="font-medium">{resale.buyer?.first_name || resale.buyer?.telegram_username || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">@{resale.buyer?.telegram_username || resale.buyer?.telegram_id}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(resale.status)}</TableCell>
                        <TableCell>{new Date(resale.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(resale)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Select
                              value={resale.status}
                              onValueChange={(value) => handleStatusChange(resale.id, value)}
                            >
                              <SelectTrigger className="w-[100px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ACTIVE">在售</SelectItem>
                                <SelectItem value="SOLD">已售出</SelectItem>
                                <SelectItem value="CANCELLED">已取消</SelectItem>
                                <SelectItem value="EXPIRED">已过期</SelectItem>
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
      </div>

      {/* 详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>转售详情</DialogTitle>
          </DialogHeader>
          {selectedResale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">转售ID</div>
                  <div className="font-mono text-sm">{selectedResale.id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">状态</div>
                  <div>{getStatusBadge(selectedResale.status)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">卖家</div>
                  <div className="font-medium">
                    {selectedResale.seller?.first_name || selectedResale.seller?.telegram_username || 'Unknown'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    @{selectedResale.seller?.telegram_username || selectedResale.seller?.telegram_id}
                  </div>
                </div>
                {selectedResale.buyer && (
                  <div>
                    <div className="text-sm text-muted-foreground">买家</div>
                    <div className="font-medium">
                      {selectedResale.buyer?.first_name || selectedResale.buyer?.telegram_username || 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @{selectedResale.buyer?.telegram_username || selectedResale.buyer?.telegram_id}
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground">夺宝商品</div>
                  <div className="font-medium">{selectedResale.prize?.lottery?.title || '未知商品'}</div>
                  <div className="text-xs text-muted-foreground">
                    期号: {selectedResale.prize?.lottery?.period} | 中奖码: {selectedResale.prize?.winning_code}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">原价</div>
                  <div className="font-medium">
                    {selectedResale.prize?.lottery?.ticket_price || 0} {selectedResale.prize?.lottery?.currency || 'TJS'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">转售价格</div>
                  <div className="font-medium text-lg">
                    {selectedResale.price || 0} {selectedResale.currency || 'TJS'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">发布时间</div>
                  <div>{new Date(selectedResale.created_at).toLocaleString()}</div>
                </div>
                {selectedResale.sold_at && (
                  <div>
                    <div className="text-sm text-muted-foreground">售出时间</div>
                    <div>{new Date(selectedResale.sold_at).toLocaleString()}</div>
                  </div>
                )}
                {selectedResale.description && (
                  <div className="col-span-2">
                    <div className="text-sm text-muted-foreground">描述</div>
                    <div className="mt-1 p-3 bg-muted rounded-lg">
                      {selectedResale.description}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
