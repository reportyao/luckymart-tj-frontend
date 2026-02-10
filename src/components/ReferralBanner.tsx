import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ShareIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { SafeMotion } from "./SafeMotion";

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
          <h5
            style={{
              color: "white",
              margin: 0,
              fontSize: "16px",
              lineHeight: "1.4",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
            }}
          >
            <ShareIcon style={{ width: 16, height: 16, marginRight: 8 }} />
            {t("banner.mainText")}
          </h5>
        </div>

        {/* 内容区域 */}
        <div style={{ marginBottom: "16px" }}>
          <span
            style={{
              color: "rgba(255, 255, 255, 0.9)",
              fontSize: "13px",
              lineHeight: "1.6",
              display: "block",
              marginBottom: "8px",
            }}
          >
            {t("banner.subText")}
          </span>
          <span
            style={{
              color: "rgba(255, 255, 255, 0.85)",
              fontSize: "12px",
              lineHeight: "1.5",
              display: "block",
            }}
          >
            {t("banner.example")}
          </span>
        </div>

        {/* 按钮区域 - 横向拉满 */}
        <button
          onClick={handleAction}
          style={{
            backgroundColor: "white",
            color: "#4CAF50",
            borderColor: "white",
            fontWeight: "bold",
            fontSize: "14px",
            height: "40px",
            width: "100%",
            borderRadius: "9999px",
            border: "1px solid white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <ArrowRightIcon style={{ width: 16, height: 16 }} />
          {t("banner.actionButton")}
        </button>
      </div>
    </SafeMotion>
  );
};

export default ReferralBanner;
