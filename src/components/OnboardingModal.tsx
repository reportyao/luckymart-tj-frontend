import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../contexts/UserContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { useNavigate } from 'react-router-dom';
import { Modal, Button, Typography, Space } from 'antd';
import { UserAddOutlined, ShareAltOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface OnboardingModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isVisible, onClose }) => {
  const { t } = useTranslation();
  const { user, profile } = useUser();
  const { supabase } = useSupabase();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // 检查用户是否已登录且未看过引导
  const shouldShow = isVisible && user && profile && !(profile as any).has_seen_onboarding;

  useEffect(() => {
    // 确保在组件卸载时不会执行异步操作
    return () => {
      setLoading(false);
    };
  }, []);

  const handleSkip = async () => {
    if (!user || !profile) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      // 标记用户已看过引导
      const { error } = await supabase
        .from('profiles')
        .update({ has_seen_onboarding: true } as any)
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile for onboarding skip:', error);
        // 即使更新失败，也允许用户跳过，避免阻塞
      } else {
        // refreshProfile(); // 刷新用户 profile
      }
    } catch (e) {
      console.error('Exception during onboarding skip:', e);
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const handleCreateLink = async () => {
    if (!user || !profile) {
      navigate('/login'); // 未登录则跳转到登录页
      return;
    }

    setLoading(true);
    try {
      // 标记用户已看过引导
      const { error } = await supabase
        .from('profiles')
        .update({ has_seen_onboarding: true } as any)
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile for onboarding action:', error);
      } else {
        // refreshProfile(); // 刷新用户 profile
      }
    } catch (e) {
      console.error('Exception during onboarding action:', e);
    } finally {
      setLoading(false);
      onClose();
      navigate('/invite'); // 跳转到邀请页面
    }
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <Modal
      open={shouldShow}
      title={null}
      footer={null}
      closable={false}
      maskClosable={false}
      centered
      width={400}
      style={{ top: 20 }}
      bodyStyle={{ padding: 30, textAlign: 'center' }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
          <ShareAltOutlined style={{ marginRight: 8 }} />
          {t('onboarding.title')}
        </Title>
        <Text type="secondary" strong>
          {t('onboarding.subtitle')}
        </Text>

        <div style={{ backgroundColor: '#f0f2f5', padding: '10px 0', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
          <Space direction="vertical" size="small">
            <Text>{t('referral.level1')} ({t('referral.level1Rate')})</Text>
            <Text>{t('referral.level2')} ({t('referral.level2Rate')})</Text>
            <Text>{t('referral.level3')} ({t('referral.level3Rate')})</Text>
            <Text strong type="success">{t('referral.totalRate')}</Text>
          </Space>
        </div>

        <Text>{t('onboarding.description')}</Text>

        <Button
          type="primary"
          size="large"
          icon={<UserAddOutlined />}
          onClick={handleCreateLink}
          loading={loading}
          style={{ width: '100%', marginTop: 10 }}
        >
          {t('onboarding.buttonText')}
        </Button>

        <Button
          type="link"
          onClick={handleSkip}
          disabled={loading}
        >
          {t('onboarding.skipText')}
        </Button>
      </Space>
    </Modal>
  );
};

export default OnboardingModal;
