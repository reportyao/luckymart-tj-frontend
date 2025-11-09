import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DepositReview() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('PENDING');
  const [selectedDeposit, setSelectedDeposit] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [adminNote, setAdminNote] = useState('');

  const { data, isLoading, refetch } = trpc.deposits.list.useQuery({
    page,
    pageSize: 20,
    status: status === 'ALL' ? undefined : status,
  });

  const reviewMutation = trpc.deposits.review.useMutation({
    onSuccess: () => {
      toast.success('审核成功');
      setShowReviewDialog(false);
      setAdminNote('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleViewDetail = (deposit: any) => {
    setSelectedDeposit(deposit);
    setShowDetailDialog(true);
  };

  const handleReview = (deposit: any, action: 'APPROVED' | 'REJECTED') => {
    setSelectedDeposit(deposit);
    setReviewAction(action);
    setShowReviewDialog(true);
  };

  const handleSubmitReview = () => {
    if (!selectedDeposit) return;
    
    reviewMutation.mutate({
      id: selectedDeposit.id,
      status: reviewAction,
      adminNote: adminNote,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDING: "default",
      APPROVED: "secondary",
      REJECTED: "destructive",
      CANCELLED: "outline",
    };
    const labels: Record<string, string> = {
      PENDING: "待审核",
      APPROVED: "已通过",
      REJECTED: "已拒绝",
      CANCELLED: "已取消",
    };
    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">充值审核</h1>
          <p className="text-muted-foreground mt-2">
            审核用户的充值申请
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
            <CardTitle>充值申请列表</CardTitle>
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
                      <TableHead>金额</TableHead>
                      <TableHead>支付方式</TableHead>
                      <TableHead>付款人</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>申请时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.map((deposit: any) => (
                      <TableRow key={deposit.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{deposit.user?.first_name || deposit.user?.telegram_username || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">@{deposit.user?.telegram_username || deposit.user?.telegram_id}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {deposit.amount || 0} {deposit.currency || 'TJS'}
                        </TableCell>
                        <TableCell>{deposit.payment_method || '-'}</TableCell>
                        <TableCell>
                          <div>
                            <div>{deposit.payer_name || '-'}</div>
                            <div className="text-xs text-muted-foreground">{deposit.payer_account || '-'}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(deposit.status)}</TableCell>
                        <TableCell>{new Date(deposit.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(deposit)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {deposit.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReview(deposit, 'APPROVED')}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReview(deposit, 'REJECTED')}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>充值详情</DialogTitle>
          </DialogHeader>
          {selectedDeposit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">订单号</div>
                  <div className="font-mono text-sm">{selectedDeposit.order_number || selectedDeposit.id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">状态</div>
                  <div>{getStatusBadge(selectedDeposit.status)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">用户</div>
                  <div className="font-medium">
                    {selectedDeposit.user?.first_name || selectedDeposit.user?.telegram_username || 'Unknown'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    @{selectedDeposit.user?.telegram_username || selectedDeposit.user?.telegram_id}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">金额</div>
                  <div className="font-medium text-lg">
                    {selectedDeposit.amount || 0} {selectedDeposit.currency || 'TJS'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">支付方式</div>
                  <div>{selectedDeposit.payment_method || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">付款人姓名</div>
                  <div>{selectedDeposit.payer_name || '-'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground">付款账号</div>
                  <div>{selectedDeposit.payer_account || '-'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground">支付凭证</div>
                  {selectedDeposit.payment_proof_images && selectedDeposit.payment_proof_images.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {selectedDeposit.payment_proof_images.map((url: string, idx: number) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`凭证 ${idx + 1}`}
                          className="w-full h-32 object-cover rounded border"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">无</div>
                  )}
                </div>
                {selectedDeposit.admin_note && (
                  <div className="col-span-2">
                    <div className="text-sm text-muted-foreground">管理员备注</div>
                    <div className="mt-1 p-3 bg-muted rounded-lg">
                      {selectedDeposit.admin_note}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 审核对话框 */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'APPROVED' ? '通过充值申请' : '拒绝充值申请'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">管理员备注</div>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="请输入备注信息（选填）"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReviewDialog(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={reviewMutation.isPending}
              variant={reviewAction === 'APPROVED' ? 'default' : 'destructive'}
            >
              {reviewMutation.isPending ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
