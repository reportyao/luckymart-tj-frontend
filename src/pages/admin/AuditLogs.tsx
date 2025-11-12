import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<string | undefined>();
  const [resource, setResource] = useState<string | undefined>();

  const { data, isLoading, refetch } = trpc.auditLogs.list.useQuery({
    page,
    pageSize: 20,
    action,
    resource,
  });

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      BALANCE_ADJUSTMENT: "default",
      LOTTERY_DRAW: "secondary",
      DEPOSIT_REVIEW: "outline",
      WITHDRAWAL_REVIEW: "outline",
      SHIPPING_UPDATE: "outline",
      STATUS_CHANGE: "outline",
    };
    const labels: Record<string, string> = {
      BALANCE_ADJUSTMENT: "余额调整",
      LOTTERY_DRAW: "开奖",
      DEPOSIT_REVIEW: "充值审核",
      WITHDRAWAL_REVIEW: "提现审核",
      SHIPPING_UPDATE: "发货更新",
      STATUS_CHANGE: "状态变更",
    };
    return <Badge variant={variants[action] || "default"}>{labels[action] || action}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">操作日志</h1>
          <p className="text-muted-foreground mt-2">
            查看所有管理员操作记录
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>筛选</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">操作类型</label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="选择操作类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部</SelectItem>
                    <SelectItem value="BALANCE_ADJUSTMENT">余额调整</SelectItem>
                    <SelectItem value="LOTTERY_DRAW">开奖</SelectItem>
                    <SelectItem value="DEPOSIT_REVIEW">充值审核</SelectItem>
                    <SelectItem value="WITHDRAWAL_REVIEW">提现审核</SelectItem>
                    <SelectItem value="SHIPPING_UPDATE">发货更新</SelectItem>
                    <SelectItem value="STATUS_CHANGE">状态变更</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">资源类型</label>
                <Select value={resource} onValueChange={setResource}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="选择资源类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部</SelectItem>
                    <SelectItem value="users">用户</SelectItem>
                    <SelectItem value="lotteries">夺宝商品</SelectItem>
                    <SelectItem value="deposits">充值</SelectItem>
                    <SelectItem value="withdrawals">提现</SelectItem>
                    <SelectItem value="shipping">发货</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>日志列表</CardTitle>
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
                      <TableHead>操作时间</TableHead>
                      <TableHead>操作人</TableHead>
                      <TableHead>操作类型</TableHead>
                      <TableHead>资源</TableHead>
                      <TableHead>描述</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">{log.user_id || '系统'}</TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="text-sm">{log.resource}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate">
                          {log.description}
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
    </DashboardLayout>
  );
}
