import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { trpc } from '@/lib/trpc'
import { toast } from 'sonner'
import { Edit, Plus, Save } from 'lucide-react'

interface PaymentConfig {
  id: string
  payment_method: string
  account_number: string
  account_name: string
  bank_name: string
  description_zh: string
  description_ru: string
  description_tg: string
  min_amount: number
  max_amount: number
  processing_time_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function PaymentConfig() {
  const [configs, setConfigs] = useState<PaymentConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingConfig, setEditingConfig] = useState<PaymentConfig | null>(null)
  const [formData, setFormData] = useState<Partial<PaymentConfig>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      setLoading(true)
      // TODO: 使用tRPC调用后端API获取支付配置列表
      // const result = await trpc.admin.getPaymentConfigs.query()
      
      // 临时mock数据
      const mockData: PaymentConfig[] = [
        {
          id: '1',
          payment_method: 'ALIF_MOBI',
          account_number: '+992900123456',
          account_name: 'LuckyMart TJ',
          bank_name: 'Alif Mobi',
          description_zh: '请通过Alif Mobi转账到以下账号',
          description_ru: 'Пожалуйста, переведите через Alif Mobi на следующий счет',
          description_tg: 'Лутфан тавассути Alif Mobi ба ҳисоби зерин гузаронед',
          min_amount: 10,
          max_amount: 10000,
          processing_time_minutes: 30,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2',
          payment_method: 'DC_BANK',
          account_number: '1234567890123456',
          account_name: 'LuckyMart TJ',
          bank_name: 'DC Bank',
          description_zh: '请通过DC Bank转账到以下账号',
          description_ru: 'Пожалуйста, переведите через DC Bank на следующий счет',
          description_tg: 'Лутфан тавассути DC Bank ба ҳисоби зерин гузаронед',
          min_amount: 10,
          max_amount: 10000,
          processing_time_minutes: 60,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
      setConfigs(mockData)
    } catch (error) {
      console.error('获取支付配置失败:', error)
      toast.error('获取支付配置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (config: PaymentConfig) => {
    setEditingConfig(config)
    setFormData(config)
    setShowEditDialog(true)
  }

  const handleSave = async () => {
    try {
      setSubmitting(true)
      
      // TODO: 调用保存API
      // if (editingConfig) {
      //   await trpc.admin.updatePaymentConfig.mutate({
      //     id: editingConfig.id,
      //     ...formData
      //   })
      // } else {
      //   await trpc.admin.createPaymentConfig.mutate(formData)
      // }

      toast.success('保存成功')
      setShowEditDialog(false)
      setEditingConfig(null)
      setFormData({})
      fetchConfigs()
    } catch (error) {
      console.error('保存失败:', error)
      toast.error('保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (config: PaymentConfig) => {
    try {
      // TODO: 调用更新API
      // await trpc.admin.updatePaymentConfig.mutate({
      //   id: config.id,
      //   is_active: !config.is_active
      // })

      toast.success(config.is_active ? '已禁用' : '已启用')
      fetchConfigs()
    } catch (error) {
      console.error('更新失败:', error)
      toast.error('更新失败')
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">支付配置管理</h1>
        <div className="flex gap-2">
          <Button onClick={fetchConfigs} variant="outline">
            刷新
          </Button>
          <Button onClick={() => {
            setEditingConfig(null)
            setFormData({
              payment_method: '',
              account_number: '',
              account_name: '',
              bank_name: '',
              description_zh: '',
              description_ru: '',
              description_tg: '',
              min_amount: 10,
              max_amount: 10000,
              processing_time_minutes: 30,
              is_active: true
            })
            setShowEditDialog(true)
          }}>
            <Plus className="w-4 h-4 mr-2" />
            添加配置
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">加载中...</div>
      ) : (
        <div className="grid gap-4">
          {configs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                暂无支付配置
              </CardContent>
            </Card>
          ) : (
            configs.map((config) => (
              <Card key={config.id}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <CardTitle>{config.payment_method}</CardTitle>
                      {config.is_active ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">启用中</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">已禁用</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.is_active}
                        onCheckedChange={() => handleToggleActive(config)}
                      />
                      <Button size="sm" variant="outline" onClick={() => handleEdit(config)}>
                        <Edit className="w-4 h-4 mr-1" />
                        编辑
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">银行名称:</span>
                      <span className="ml-2 font-medium">{config.bank_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">账户名:</span>
                      <span className="ml-2 font-medium">{config.account_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">账号:</span>
                      <span className="ml-2 font-medium">{config.account_number}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">处理时间:</span>
                      <span className="ml-2 font-medium">{config.processing_time_minutes} 分钟</span>
                    </div>
                    <div>
                      <span className="text-gray-500">金额范围:</span>
                      <span className="ml-2 font-medium">{config.min_amount} - {config.max_amount} TJS</span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div>
                      <span className="text-xs text-gray-500">中文说明:</span>
                      <p className="text-sm mt-1 bg-gray-50 p-2 rounded">{config.description_zh}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">俄语说明:</span>
                      <p className="text-sm mt-1 bg-gray-50 p-2 rounded">{config.description_ru}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">塔吉克语说明:</span>
                      <p className="text-sm mt-1 bg-gray-50 p-2 rounded">{config.description_tg}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* 编辑对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingConfig ? '编辑支付配置' : '添加支付配置'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payment_method">支付方式</Label>
                <Input
                  id="payment_method"
                  value={formData.payment_method || ''}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  placeholder="例: ALIF_MOBI"
                />
              </div>
              <div>
                <Label htmlFor="bank_name">银行名称</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name || ''}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="例: Alif Mobi"
                />
              </div>
              <div>
                <Label htmlFor="account_name">账户名</Label>
                <Input
                  id="account_name"
                  value={formData.account_name || ''}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  placeholder="例: LuckyMart TJ"
                />
              </div>
              <div>
                <Label htmlFor="account_number">账号</Label>
                <Input
                  id="account_number"
                  value={formData.account_number || ''}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="例: +992900123456"
                />
              </div>
              <div>
                <Label htmlFor="min_amount">最小金额 (TJS)</Label>
                <Input
                  id="min_amount"
                  type="number"
                  value={formData.min_amount || 10}
                  onChange={(e) => setFormData({ ...formData, min_amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="max_amount">最大金额 (TJS)</Label>
                <Input
                  id="max_amount"
                  type="number"
                  value={formData.max_amount || 10000}
                  onChange={(e) => setFormData({ ...formData, max_amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="processing_time">处理时间 (分钟)</Label>
                <Input
                  id="processing_time"
                  type="number"
                  value={formData.processing_time_minutes || 30}
                  onChange={(e) => setFormData({ ...formData, processing_time_minutes: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="is_active"
                  checked={formData.is_active !== false}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">启用</Label>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div>
                <Label htmlFor="description_zh">中文说明</Label>
                <Textarea
                  id="description_zh"
                  value={formData.description_zh || ''}
                  onChange={(e) => setFormData({ ...formData, description_zh: e.target.value })}
                  placeholder="请输入中文说明..."
                  rows={3}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="description_ru">俄语说明</Label>
                <Textarea
                  id="description_ru"
                  value={formData.description_ru || ''}
                  onChange={(e) => setFormData({ ...formData, description_ru: e.target.value })}
                  placeholder="请输入俄语说明..."
                  rows={3}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="description_tg">塔吉克语说明</Label>
                <Textarea
                  id="description_tg"
                  value={formData.description_tg || ''}
                  onChange={(e) => setFormData({ ...formData, description_tg: e.target.value })}
                  placeholder="请输入塔吉克语说明..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              <Save className="w-4 h-4 mr-2" />
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
