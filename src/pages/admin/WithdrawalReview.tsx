import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { trpc } from '@/lib/trpc'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Eye, Clock, Upload } from 'lucide-react'

interface WithdrawalRequest {
  id: string
  user_id: string
  order_number: string
  amount: number
  currency: string
  withdrawal_method: string
  bank_name: string
  bank_account_number: string
  bank_account_name: string
  bank_branch: string
  id_card_number: string
  id_card_name: string
  phone_number: string
  mobile_wallet_number: string
  mobile_wallet_name: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED'
  admin_note: string
  transfer_proof_images: string[]
  transfer_reference: string
  created_at: string
  updated_at: string
  user?: {
    telegram_username: string
    first_name: string
  }
}

export default function WithdrawalReview() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [adminNote, setAdminNote] = useState('')
  const [transferReference, setTransferReference] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchWithdrawals()
  }, [])

  const fetchWithdrawals = async () => {
    try {
      setLoading(true)
      
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-withdrawals`)
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (result.success && result.data) {
        setWithdrawals(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch withdrawals')
      }
    } catch (error) {
      console.error('获取提现申请失败:', error)
      toast.error('获取提现申请失败')
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async () => {
    if (!selectedWithdrawal) return

    try {
      setSubmitting(true)
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/approve-withdrawal`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requestId: selectedWithdrawal.id,
            action: reviewAction,
            stage: 'INITIAL',
            adminNote: adminNote
          })
        }
      )

      const result = await response.json()

      if (result.success) {
        toast.success(reviewAction === 'APPROVED' ? '审核通过' : '已拒绝')
        setShowReviewDialog(false)
        setSelectedWithdrawal(null)
        setAdminNote('')
        fetchWithdrawals()
      } else {
        throw new Error(result.error || 'Review failed')
      }
    } catch (error) {
      console.error('审核失败:', error)
      toast.error('审核失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleComplete = async () => {
    if (!selectedWithdrawal) return

    try {
      setSubmitting(true)
      
      // TODO: 调用完成API
      // await trpc.admin.approveWithdrawal.mutate({
      //   requestId: selectedWithdrawal.id,
      //   action: 'COMPLETED',
      //   transferReference: transferReference
      // })

      toast.success('转账完成')
      setShowCompleteDialog(false)
      setSelectedWithdrawal(null)
      setTransferReference('')
      fetchWithdrawals()
    } catch (error) {
      console.error('完成失败:', error)
      toast.error('完成失败')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="w-3 h-3 mr-1" />待审核</Badge>
      case 'APPROVED':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300"><CheckCircle className="w-3 h-3 mr-1" />已通过</Badge>
      case 'PROCESSING':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300"><Clock className="w-3 h-3 mr-1" />处理中</Badge>
      case 'COMPLETED':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />已完成</Badge>
      case 'REJECTED':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="w-3 h-3 mr-1" />已拒绝</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">提现审核</h1>
        <Button onClick={fetchWithdrawals} variant="outline">
          刷新
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">加载中...</div>
      ) : (
        <div className="grid gap-4">
          {withdrawals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                暂无待审核的提现申请
              </CardContent>
            </Card>
          ) : (
            withdrawals.map((withdrawal) => (
              <Card key={withdrawal.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold">{withdrawal.order_number}</span>
                        {getStatusBadge(withdrawal.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">用户:</span>
                          <span className="ml-2 font-medium">{withdrawal.user?.first_name || withdrawal.user_id}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">金额:</span>
                          <span className="ml-2 font-bold text-red-600">{withdrawal.amount} {withdrawal.currency}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">提现方式:</span>
                          <span className="ml-2">{withdrawal.withdrawal_method}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">账户名:</span>
                          <span className="ml-2">{withdrawal.bank_account_name || withdrawal.mobile_wallet_name}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">提交时间:</span>
                          <span className="ml-2">{formatDate(withdrawal.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedWithdrawal(withdrawal)
                          setShowDetailDialog(true)
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        查看详情
                      </Button>
                      {withdrawal.status === 'PENDING' && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              setSelectedWithdrawal(withdrawal)
                              setReviewAction('APPROVED')
                              setShowReviewDialog(true)
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            通过
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedWithdrawal(withdrawal)
                              setReviewAction('REJECTED')
                              setShowReviewDialog(true)
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            拒绝
                          </Button>
                        </>
                      )}
                      {withdrawal.status === 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => {
                            setSelectedWithdrawal(withdrawal)
                            setShowCompleteDialog(true)
                          }}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          完成转账
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* 详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>提现申请详情</DialogTitle>
          </DialogHeader>
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">订单号</label>
                  <p className="font-medium">{selectedWithdrawal.order_number}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">状态</label>
                  <div className="mt-1">{getStatusBadge(selectedWithdrawal.status)}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">金额</label>
                  <p className="font-bold text-red-600">{selectedWithdrawal.amount} {selectedWithdrawal.currency}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">提现方式</label>
                  <p className="font-medium">{selectedWithdrawal.withdrawal_method}</p>
                </div>
              </div>

              {selectedWithdrawal.withdrawal_method === 'BANK_TRANSFER' ? (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">银行卡信息</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">银行名称</label>
                      <p className="font-medium">{selectedWithdrawal.bank_name}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">账户名</label>
                      <p className="font-medium">{selectedWithdrawal.bank_account_name}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm text-gray-500">账号</label>
                      <p className="font-medium">{selectedWithdrawal.bank_account_number}</p>
                    </div>
                    {selectedWithdrawal.bank_branch && (
                      <div className="col-span-2">
                        <label className="text-sm text-gray-500">开户支行</label>
                        <p className="font-medium">{selectedWithdrawal.bank_branch}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">钱包信息</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">钱包号码</label>
                      <p className="font-medium">{selectedWithdrawal.mobile_wallet_number}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">账户名</label>
                      <p className="font-medium">{selectedWithdrawal.mobile_wallet_name}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">身份信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">姓名</label>
                    <p className="font-medium">{selectedWithdrawal.id_card_name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">身份证号</label>
                    <p className="font-medium">{selectedWithdrawal.id_card_number}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">手机号</label>
                    <p className="font-medium">{selectedWithdrawal.phone_number}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">提交时间</label>
                    <p className="font-medium">{formatDate(selectedWithdrawal.created_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">更新时间</label>
                    <p className="font-medium">{formatDate(selectedWithdrawal.updated_at)}</p>
                  </div>
                </div>
              </div>

              {selectedWithdrawal.admin_note && (
                <div className="border-t pt-4">
                  <label className="text-sm text-gray-500">审核备注</label>
                  <p className="font-medium bg-gray-50 p-3 rounded-lg mt-2">{selectedWithdrawal.admin_note}</p>
                </div>
              )}

              {selectedWithdrawal.transfer_reference && (
                <div className="border-t pt-4">
                  <label className="text-sm text-gray-500">转账参考号</label>
                  <p className="font-medium bg-gray-50 p-3 rounded-lg mt-2">{selectedWithdrawal.transfer_reference}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 审核对话框 */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'APPROVED' ? '审核通过' : '拒绝申请'}
            </DialogTitle>
          </DialogHeader>
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">订单号: {selectedWithdrawal.order_number}</p>
                <p className="text-sm text-gray-500">金额: {selectedWithdrawal.amount} {selectedWithdrawal.currency}</p>
              </div>
              <div>
                <label className="text-sm font-medium">审核备注 (可选)</label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="请输入审核备注..."
                  rows={4}
                  className="mt-2"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleReview}
              disabled={submitting}
              className={reviewAction === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {submitting ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 完成转账对话框 */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>完成转账</DialogTitle>
          </DialogHeader>
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">订单号: {selectedWithdrawal.order_number}</p>
                <p className="text-sm text-gray-500">金额: {selectedWithdrawal.amount} {selectedWithdrawal.currency}</p>
              </div>
              <div>
                <label className="text-sm font-medium">转账参考号</label>
                <Input
                  value={transferReference}
                  onChange={(e) => setTransferReference(e.target.value)}
                  placeholder="请输入转账参考号..."
                  className="mt-2"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                请确认已完成转账操作后再点击确认
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleComplete}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? '处理中...' : '确认完成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
