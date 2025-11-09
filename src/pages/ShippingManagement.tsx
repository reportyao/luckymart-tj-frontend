import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Package, Truck, CheckCircle, Clock, Eye } from 'lucide-react'

interface ShippingRequest {
  id: string
  prize_id: string
  user_id: string
  recipient_name: string
  recipient_phone: string
  recipient_address: string
  recipient_city: string
  recipient_country: string
  tracking_number: string | null
  shipping_company: string | null
  shipping_method: string | null
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED'
  requested_at: string
  shipped_at: string | null
  delivered_at: string | null
  notes: string | null
  admin_notes: string | null
  user?: {
    telegram_username: string
    first_name: string
  }
  prize?: {
    prize_name: string
    prize_image: string
    winning_code: string
    lottery?: {
      title: string
    }
  }
}

export default function ShippingManagement() {
  const [shippings, setShippings] = useState<ShippingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShipping, setSelectedShipping] = useState<ShippingRequest | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [newStatus, setNewStatus] = useState<string>('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingCompany, setShippingCompany] = useState('')
  const [shippingMethod, setShippingMethod] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  useEffect(() => {
    fetchShippings()
  }, [filterStatus])

  const fetchShippings = async () => {
    try {
      setLoading(true)
      
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-shipping`)
      if (filterStatus !== 'ALL') {
        url.searchParams.append('status', filterStatus)
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (result.success && result.data) {
        setShippings(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch shippings')
      }
    } catch (error) {
      console.error('获取发货申请失败:', error)
      toast.error('获取发货申请失败')
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = (shipping: ShippingRequest) => {
    setSelectedShipping(shipping)
    setShowDetailDialog(true)
  }

  const handleUpdateStatus = (shipping: ShippingRequest) => {
    setSelectedShipping(shipping)
    setNewStatus(shipping.status)
    setTrackingNumber(shipping.tracking_number || '')
    setShippingCompany(shipping.shipping_company || '')
    setShippingMethod(shipping.shipping_method || '')
    setAdminNotes(shipping.admin_notes || '')
    setShowUpdateDialog(true)
  }

  const submitUpdate = async () => {
    if (!selectedShipping || !newStatus) {
      toast.error('请选择状态')
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-shipping`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            shippingId: selectedShipping.id,
            status: newStatus,
            trackingNumber: trackingNumber || null,
            shippingCompany: shippingCompany || null,
            shippingMethod: shippingMethod || null,
            adminNotes: adminNotes || null
          })
        }
      )

      const result = await response.json()

      if (result.success) {
        toast.success('发货状态更新成功')
        setShowUpdateDialog(false)
        fetchShippings()
      } else {
        throw new Error(result.error || 'Update failed')
      }
    } catch (error: any) {
      console.error('更新发货状态失败:', error)
      toast.error(error.message || '更新发货状态失败')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      PENDING: { text: '待发货', variant: 'outline' },
      PROCESSING: { text: '处理中', variant: 'secondary' },
      SHIPPED: { text: '已发货', variant: 'default' },
      IN_TRANSIT: { text: '运输中', variant: 'default' },
      DELIVERED: { text: '已送达', variant: 'default' },
      FAILED: { text: '失败', variant: 'destructive' }
    }
    const badge = badges[status] || badges.PENDING
    return <Badge variant={badge.variant}>{badge.text}</Badge>
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-5 h-5 text-gray-400" />
      case 'PROCESSING':
        return <Package className="w-5 h-5 text-blue-500" />
      case 'SHIPPED':
      case 'IN_TRANSIT':
        return <Truck className="w-5 h-5 text-purple-500" />
      case 'DELIVERED':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">发货管理</h1>
        <div className="flex gap-2">
          {['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'].map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(status)}
            >
              {status === 'ALL' ? '全部' : status}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {shippings.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              暂无发货申请
            </CardContent>
          </Card>
        ) : (
          shippings.map((shipping) => (
            <Card key={shipping.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <div className="flex-shrink-0">
                      {getStatusIcon(shipping.status)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-lg">
                          {shipping.prize?.prize_name || '未知商品'}
                        </h3>
                        {getStatusBadge(shipping.status)}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>中奖码: {shipping.prize?.winning_code}</div>
                        <div>收货人: {shipping.recipient_name} ({shipping.recipient_phone})</div>
                        <div>地址: {shipping.recipient_address}, {shipping.recipient_city}, {shipping.recipient_country}</div>
                        {shipping.tracking_number && (
                          <div>物流单号: {shipping.tracking_number} ({shipping.shipping_company})</div>
                        )}
                        <div>申请时间: {new Date(shipping.requested_at).toLocaleString('zh-CN')}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetail(shipping)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      查看
                    </Button>
                    {shipping.status !== 'DELIVERED' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleUpdateStatus(shipping)}
                      >
                        更新状态
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>发货详情</DialogTitle>
          </DialogHeader>
          {selectedShipping && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">商品名称</div>
                  <div className="font-medium">{selectedShipping.prize?.prize_name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">中奖码</div>
                  <div className="font-medium">{selectedShipping.prize?.winning_code}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">收货人</div>
                  <div className="font-medium">{selectedShipping.recipient_name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">联系电话</div>
                  <div className="font-medium">{selectedShipping.recipient_phone}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-gray-500">收货地址</div>
                  <div className="font-medium">
                    {selectedShipping.recipient_address}, {selectedShipping.recipient_city}, {selectedShipping.recipient_country}
                  </div>
                </div>
                {selectedShipping.tracking_number && (
                  <>
                    <div>
                      <div className="text-sm text-gray-500">物流单号</div>
                      <div className="font-medium">{selectedShipping.tracking_number}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">物流公司</div>
                      <div className="font-medium">{selectedShipping.shipping_company}</div>
                    </div>
                  </>
                )}
                {selectedShipping.notes && (
                  <div className="col-span-2">
                    <div className="text-sm text-gray-500">用户备注</div>
                    <div className="font-medium">{selectedShipping.notes}</div>
                  </div>
                )}
                {selectedShipping.admin_notes && (
                  <div className="col-span-2">
                    <div className="text-sm text-gray-500">管理员备注</div>
                    <div className="font-medium">{selectedShipping.admin_notes}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 更新状态对话框 */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>更新发货状态</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">状态</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full mt-1 p-2 border rounded-md"
              >
                <option value="PENDING">待发货</option>
                <option value="PROCESSING">处理中</option>
                <option value="SHIPPED">已发货</option>
                <option value="IN_TRANSIT">运输中</option>
                <option value="DELIVERED">已送达</option>
                <option value="FAILED">失败</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">物流单号</label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="请输入物流单号"
              />
            </div>
            <div>
              <label className="text-sm font-medium">物流公司</label>
              <Input
                value={shippingCompany}
                onChange={(e) => setShippingCompany(e.target.value)}
                placeholder="请输入物流公司"
              />
            </div>
            <div>
              <label className="text-sm font-medium">配送方式</label>
              <Input
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value)}
                placeholder="请输入配送方式"
              />
            </div>
            <div>
              <label className="text-sm font-medium">管理员备注</label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="请输入备注"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
              取消
            </Button>
            <Button onClick={submitUpdate} disabled={submitting}>
              {submitting ? '提交中...' : '确认更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
