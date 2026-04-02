'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Button, Spin } from 'antd';
import { useAuth } from '@/context/AuthContext';
import { LogoutOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50 relative">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        {user && (
           <div className="flex items-center gap-2">
              <span className="text-gray-600">
                Welcome, {user.username} ({user.role === 'ADMIN' ? '管理员' : '项目资料员'})
              </span>
              <Button type="text" icon={<LogoutOutlined />} onClick={logout}>
                Logout
              </Button>
           </div>
        )}
      </div>

      <h1 className="text-4xl font-bold mb-8 text-gray-800">物料报审及认样系统</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        <Link href="/search" className="block">
          <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full border border-gray-200">
            <h2 className="text-2xl font-semibold mb-2 text-blue-600">全局检索</h2>
            <p className="text-gray-600">查询所有厂家、物料及通用资质证书。</p>
          </div>
        </Link>
        <Link href="/archive" className="block">
          <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full border border-gray-200">
            <h2 className="text-2xl font-semibold mb-2 text-green-600">项目档案</h2>
            <p className="text-gray-600">管理各项目的物料认样与归档资料。</p>
          </div>
        </Link>
        <Link href="/upload" className="block">
          <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full border border-gray-200">
            <h2 className="text-2xl font-semibold mb-2 text-purple-600">资料录入</h2>
            <p className="text-gray-600">上传新的厂家、物料及证书文件。</p>
          </div>
        </Link>
        
        <Link href="/ratings" className="block">
          <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full border border-gray-200">
            <h2 className="text-2xl font-semibold mb-2 text-yellow-600">供应商评分</h2>
            <p className="text-gray-600">查看及导入供应商年度绩效评分。</p>
          </div>
        </Link>

        <Link href="/dashboard" className="block">
          <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full border border-gray-200">
            <h2 className="text-2xl font-semibold mb-2 text-cyan-600">数据看板</h2>
            <p className="text-gray-600">查看系统数据统计及图表概览。</p>
          </div>
        </Link>
        
        {/* New Application Management Link - Visible only to non-admins */}
        {user?.role !== 'ADMIN' && (
          <Link href="/my/applications" className="block">
            <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full border border-gray-200">
              <h2 className="text-2xl font-semibold mb-2 text-orange-600">申请管理</h2>
              <p className="text-gray-600">查看我的资料录入及权限申请进度。</p>
            </div>
          </Link>
        )}

        {user?.role === 'ADMIN' && (
          <Link href="/admin/approvals" className="block">
            <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full border border-gray-200 border-l-4 border-l-red-500">
              <h2 className="text-2xl font-semibold mb-2 text-red-600">审批管理</h2>
              <p className="text-gray-600">审核资料录入及项目权限申请。</p>
            </div>
          </Link>
        )}
      </div>
    </main>
  );
}
