import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <h1 className="text-6xl font-bold text-gray-800">404</h1>
      <h2 className="text-2xl font-semibold mt-4 mb-2 text-gray-600">页面未找到</h2>
      <p className="text-gray-500 mb-6 text-center">
        抱歉，您访问的页面不存在。
      </p>
      <button 
        onClick={() => navigate('/')}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors"
      >
        返回首页
      </button>
    </div>
  );
}
