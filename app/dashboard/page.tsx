'use client';

import React, { useEffect, useState } from 'react';
import { Card, Statistic, Row, Col, Button, message, Divider } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { DeleteOutlined, HomeOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Dashboard() {
    const { user } = useAuth();
    const [data, setData] = useState<any>(null);
    const [cleanupLoading, setCleanupLoading] = useState(false);

    useEffect(() => {
        fetch('/api/stats').then(res => res.json()).then(setData);
    }, []);

    const handleCleanup = async () => {
        setCleanupLoading(true);
        try {
            const res = await fetch('/api/admin/cleanup', { method: 'POST' });
            const json = await res.json();
            if (res.ok && json.success) {
                message.success(`清理成功：删除了 ${json.details.deletedMaterials} 个物料，${json.details.deletedManufacturers} 个厂家。`);
            } else {
                message.error(json.message || '清理失败');
            }
        } catch (e) {
            message.error('清理过程中发生系统错误');
        } finally {
            setCleanupLoading(false);
        }
    };

    if (!data) return <div className="p-8">加载中...</div>;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">数据看板 (Dashboard)</h1>
                <Link href="/">
                    <Button icon={<HomeOutlined />}>返回首页</Button>
                </Link>
            </div>
            
            <Row gutter={16} className="mb-8">
                <Col span={8}>
                    <Card>
                        <Statistic title="厂家总数" value={data.counts.manufacturers} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic title="物料总数" value={data.counts.materials} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic title="项目总数" value={data.counts.projects} />
                    </Card>
                </Col>
            </Row>

            <Row gutter={16} className="mb-8">
                <Col span={12}>
                    <Card title="厂家国别分布">
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.countryStats}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                        label
                                    >
                                        {data.countryStats.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card title="厂家类别分布 (按文档)">
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.roleStats}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        fill="#82ca9d"
                                        dataKey="value"
                                        label
                                    >
                                        {data.roleStats?.map((entry: any, index: number) => (
                                            <Cell key={`cell-role-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
            </Row>

            <Row gutter={16} className="mb-8">
                <Col span={24}>
                    <Card title="项目认样情况">
                         <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.projectStats}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="materials" fill="#82ca9d" name="物料数量" />
                                    <Bar dataKey="manufacturers" fill="#8884d8" name="厂家数量" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
            </Row>

            {user?.role === 'ADMIN' && (
                <div className="mt-8">
                    <Divider orientation="left">系统管理</Divider>
                    <Card title="数据库维护" className="border-red-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold">幽灵数据清理</h3>
                                <p className="text-gray-500">
                                    手动清理数据库中的孤立数据：
                                    <br/>
                                    1. 厂家：无物料、无文档且无评分记录。
                                    <br/>
                                    2. 物料：无文档且无项目归档关联。
                                    <br/>
                                    <span className="text-xs text-gray-400">注意：系统会在每天 09:00 AM 自动运行此清理任务。</span>
                                </p>
                            </div>
                            <Button 
                                type="primary" 
                                danger 
                                icon={<DeleteOutlined />} 
                                loading={cleanupLoading}
                                onClick={handleCleanup}
                            >
                                执行清理
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
