import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button, Typography } from "antd";
import { ShareAltOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { SafeMotion } from "./SafeMotion";

const { Title, Text } = Typography;

const ReferralBanner: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleAction = () => {
    navigate("/invite");
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
          background: "linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)",
          borderRadius: "16px",
          color: "white",
          padding: "16px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        }}
      >
        {/* 标题区域 - 横向拉满 */}
        <div style={{ marginBottom: "12px" }}>
          <Title 
            level={5} 
            style={{ 
              color: "white", 
              margin: 0, 
              fontSize: "16px",
              lineHeight: "1.4",
              fontWeight: "bold"
            }}
          >
            <ShareAltOutlined style={{ marginRight: 8, fontSize: "16px" }} />
            {t("banner.mainText")}
          </Title>
        </div>

        {/* 内容区域 */}
        <div style={{ marginBottom: "16px" }}>
          <Text 
            style={{ 
              color: "rgba(255, 255, 255, 0.9)", 
              fontSize: "13px",
              lineHeight: "1.6",
              display: "block",
              marginBottom: "8px"
            }}
          >
            {t("banner.subText")}
          </Text>
          <Text 
            style={{ 
              color: "rgba(255, 255, 255, 0.85)", 
              fontSize: "12px", 
              lineHeight: "1.5",
              display: "block"
            }}
          >
            {t("banner.example")}
          </Text>
        </div>

        {/* 按钮区域 - 横向拉满 */}
        <Button
          type="primary"
          shape="round"
          icon={<ArrowRightOutlined />}
          onClick={handleAction}
          block
          style={{
            backgroundColor: "white",
            color: "#4CAF50",
            borderColor: "white",
            fontWeight: "bold",
            fontSize: "14px",
            height: "40px",
          }}
        >
          {t("banner.actionButton")}
        </Button>
      </div>
    </SafeMotion>
  );
};

export default ReferralBanner;
