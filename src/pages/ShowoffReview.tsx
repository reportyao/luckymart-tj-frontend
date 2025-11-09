import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye, CheckCircle, XCircle, Image as ImageIcon } from "lucide-react";

export default function ShowoffReview() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("PENDING");
  const [selectedShowoff, setSelectedShowoff] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approveStatus, setApproveStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [adminNotes, setAdminNotes] = useState('');

  const { data, isLoading, refetch } = trpc.showoffs.list.useQuery({
    page,
    pageSize: 20,
    status: status === 'ALL' ? undefined : status,
  });

  const approveMutation = trpc.showoffs.approve.useMutation({
    onSuccess: () => {
      toast.success("审核成功");
      setShowApproveDialog(false);
      setAdminNotes('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleViewDetail = (showoff: any) => {
    setSelectedShowoff(showoff);
    setShowDetailDialog(true);
  };

  const handleApprove = (showoff: any, status: 'APPROVED' | 'REJECTED') => {
    setSelectedShowoff(showoff);
    setApproveStatus(status);
    setShowApproveDialog(true);
  };

  const submitApprove = () => {
    if (!selectedShowoff) return;
    
    approveMutation.mutate({
      id: selectedShowoff.id,
      status: approveStatus,
      adminNotes: adminNotes || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDING: "outline",
      APPROVED: "default",
      REJECTED: "destructive",
    };
    const labels: Record<string, string> = {
      PENDING: "待审核",
      APPROVED: "已通过",
      REJECTED: "已拒绝",
    };
    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">晒单审核</h1>
          <p className="text-muted-foreground mt-2">
            审核用户提交的中奖晒单
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
                <SelectItem value="PENDING">待审核</SelectItem>
                <SelectItem value="APPROVED">已通过</SelectItem>
                <SelectItem value="REJECTED">已拒绝</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>晒单列表</CardTitle>
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
                      <TableHead>用户</TableHead>
                      <TableHead>夺宝商品</TableHead>
                      <TableHead>中奖码</TableHead>
                      <TableHead>晒单内容</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>提交时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.map((showoff: any) => (
                      <TableRow key={showoff.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{showoff.user?.first_name || showoff.user?.telegram_username || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">@{showoff.user?.telegram_username || showoff.user?.telegram_id}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{showoff.prize?.lottery?.title || '未知商品'}</div>
                          <div className="text-xs text-muted-foreground">期号: {showoff.prize?.lottery?.period}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {showoff.prize?.winning_code || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate">{showoff.content || '-'}</div>
                          {showoff.images && showoff.images.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <ImageIcon className="h-3 w-3" />
                              {showoff.images.length} 张图片
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(showoff.status)}</TableCell>
                        <TableCell>{new Date(showoff.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(showoff)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {showoff.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleApprove(showoff, 'APPROVED')}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleApprove(showoff, 'REJECTED')}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>晒单详情</DialogTitle>
          </DialogHeader>
          {selectedShowoff && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">用户</div>
                  <div className="font-medium">
                    {selectedShowoff.user?.first_name || selectedShowoff.user?.telegram_username || 'Unknown'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    @{selectedShowoff.user?.telegram_username || selectedShowoff.user?.telegram_id}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">状态</div>
                  <div>{getStatusBadge(selectedShowoff.status)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground">夺宝商品</div>
                  <div className="font-medium">{selectedShowoff.prize?.lottery?.title || '未知商品'}</div>
                  <div className="text-xs text-muted-foreground">
                    期号: {selectedShowoff.prize?.lottery?.period} | 中奖码: {selectedShowoff.prize?.winning_code}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground">晒单内容</div>
                  <div className="mt-1 p-3 bg-muted rounded-lg">
                    {selectedShowoff.content || '无文字内容'}
                  </div>
                </div>
                {selectedShowoff.images && selectedShowoff.images.length > 0 && (
                  <div className="col-span-2">
                    <div className="text-sm text-muted-foreground mb-2">晒单图片</div>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedShowoff.images.map((image: string, index: number) => (
                        <img
                          key={index}
                          src={image}
                          alt={`晒单图片 ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-muted-foreground">提交时间</div>
                  <div>{new Date(selectedShowoff.created_at).toLocaleString()}</div>
                </div>
                {selectedShowoff.reviewed_at && (
                  <div>
                    <div className="text-sm text-muted-foreground">审核时间</div>
                    <div>{new Date(selectedShowoff.reviewed_at).toLocaleString()}</div>
                  </div>
                )}
                {selectedShowoff.admin_notes && (
                  <div className="col-span-2">
                    <div className="text-sm text-muted-foreground">管理员备注</div>
                    <div className="mt-1 p-3 bg-muted rounded-lg">
                      {selectedShowoff.admin_notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 审核对话框 */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approveStatus === 'APPROVED' ? '通过晒单' : '拒绝晒单'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>管理员备注 (可选)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="填写审核备注..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              取消
            </Button>
            <Button
              onClick={submitApprove}
              disabled={approveMutation.isPending}
              variant={approveStatus === 'APPROVED' ? 'default' : 'destructive'}
            >
              {approveMutation.isPending ? "提交中..." : "确认"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
