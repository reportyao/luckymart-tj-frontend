import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Space } from 'antd';
import { ShareAltOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { SafeMotion } from './SafeMotion';

const { Title, Text } = Typography;

const ReferralBanner: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleAction = () => {
    navigate('/invite');
  };

  return (
    <SafeMotion
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="px-4 mt-6"
    >
      <div

        style={{
          background: 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)',
          borderRadius: '16px',
          color: 'white',
          padding: '10px 15px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}

      >
        <div className="flex items-center justify-between">
          <Space direction="vertical" size={4} style={{ flexGrow: 1 }}>
            <Title level={5} style={{ color: 'white', margin: 0 }}>
              <ShareAltOutlined style={{ marginRight: 8 }} />
              {t('banner.mainText')}
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
              {t('banner.subText')}
            </Text>
            <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '10px', marginTop: '4px' }}>
              {t('banner.example')}
            </Text>
          </Space>
          <Button
            type="primary"
            shape="round"
            icon={<ArrowRightOutlined />}
            onClick={handleAction}
            style={{
              backgroundColor: 'white',
              color: '#4CAF50',
              borderColor: 'white',
              fontWeight: 'bold',
              flexShrink: 0,
              marginLeft: '15px',
            }}
          >
            {t('banner.actionButton')}
          </Button>
        </div>
      </div>
    </SafeMotion>
  );
};

export default ReferralBanner;
