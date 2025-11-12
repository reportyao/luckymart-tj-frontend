import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Search, ChevronLeft, ChevronRight, Eye } from "lucide-react";

export default function Orders() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const { data, isLoading } = trpc.orders.list.useQuery({
    page,
    pageSize: 20,
  });

  const handleViewDetail = (order: any) => {
    setSelectedOrder(order);
    setShowDetailDialog(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">订单管理</h1>
          <p className="text-muted-foreground mt-2">
            查看所有购买订单记录
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>筛选</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索用户名、订单ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>订单列表</CardTitle>
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
                      <TableHead>订单ID</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead>夺宝商品</TableHead>
                      <TableHead>中奖码</TableHead>
                      <TableHead>购买数量</TableHead>
                      <TableHead>总金额</TableHead>
                      <TableHead>购买时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.user?.first_name || order.user?.telegram_username || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">@{order.user?.telegram_username || order.user?.telegram_id}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{order.lottery?.title || '未知商品'}</div>
                          <div className="text-xs text-muted-foreground">期号: {order.lottery?.period}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {order.winning_code || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>{order.quantity || 1}</TableCell>
                        <TableCell className="font-medium">
                          {order.total_amount || 0} {order.currency || 'TJS'}
                        </TableCell>
                        <TableCell>{new Date(order.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(order)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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

      {/* 订单详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>订单详情</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">订单ID</div>
                  <div className="font-mono text-sm">{selectedOrder.id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">购买时间</div>
                  <div>{new Date(selectedOrder.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">用户</div>
                  <div className="font-medium">
                    {selectedOrder.user?.first_name || selectedOrder.user?.telegram_username || 'Unknown'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    @{selectedOrder.user?.telegram_username || selectedOrder.user?.telegram_id}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">中奖码</div>
                  <div className="font-mono font-medium">
                    {selectedOrder.winning_code || '未分配'}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground">夺宝商品</div>
                  <div className="font-medium">{selectedOrder.lottery?.title || '未知商品'}</div>
                  <div className="text-xs text-muted-foreground">
                    期号: {selectedOrder.lottery?.period} | 票价: {selectedOrder.lottery?.ticket_price} {selectedOrder.lottery?.currency}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">购买数量</div>
                  <div className="font-medium">{selectedOrder.quantity || 1} 张</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">总金额</div>
                  <div className="font-medium text-lg">
                    {selectedOrder.total_amount || 0} {selectedOrder.currency || 'TJS'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">支付方式</div>
                  <div>{selectedOrder.payment_method || '余额支付'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">是否中奖</div>
                  <div>
                    {selectedOrder.is_winner ? (
                      <Badge variant="default">已中奖</Badge>
                    ) : (
                      <Badge variant="secondary">未中奖</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
