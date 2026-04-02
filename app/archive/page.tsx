'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Form, Input, message, Dropdown, MenuProps, Statistic, Row, Col } from 'antd';
import Link from 'next/link';
import { PlusOutlined, FolderOutlined, MoreOutlined, EditOutlined, DeleteOutlined, FileTextOutlined, ShopOutlined, HomeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/context/AuthContext';

export default function ArchivePage() {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [form] = Form.useForm();

    const fetchProjects = async () => {
        const res = await fetch('/api/projects');
        const json = await res.json();
        setProjects(json);
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const openModal = (project?: any) => {
        setEditingProject(project);
        if (project) {
            form.setFieldsValue(project);
        } else {
            form.resetFields();
        }
        setIsModalOpen(true);
    };

    const handleCreateOrUpdate = async (values: any) => {
        let res;
        if (editingProject) {
            // Update
            res = await fetch(`/api/projects/${editingProject.id}`, {
                method: 'PUT',
                body: JSON.stringify(values)
            });
        } else {
            // Create
            res = await fetch('/api/projects', {
                method: 'POST',
                body: JSON.stringify(values)
            });
        }

        if (res.ok) {
            message.success(editingProject ? '项目已更新' : '项目已创建');
            setIsModalOpen(false);
            fetchProjects();
        } else {
            message.error('操作失败');
        }
    };

    const handleDelete = async (id: string) => {
        Modal.confirm({
            title: '确认删除',
            content: '确定要删除该项目吗？这将删除项目下的所有关联记录（不会删除主物料库文件）。',
            okText: '确认',
            cancelText: '取消',
            okType: 'danger',
            onOk: async () => {
                const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    message.success('项目已删除');
                    fetchProjects();
                } else {
                    const data = await res.json().catch(() => ({}));
                    message.error(data.error || '删除失败');
                }
            }
        });
    };

    const handleRequestAccess = async (id: string) => {
        try {
            const res = await fetch(`/api/projects/${id}/join`, { method: 'POST' });
            const json = await res.json();
            if (json.success) {
                message.success('申请已提交，请等待管理员审核');
                fetchProjects();
            } else {
                message.error(json.message);
            }
        } catch (error) {
            message.error('Request failed');
        }
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">项目档案库 (Project Archive)</h1>
                <Link href="/">
                    <Button icon={<HomeOutlined />}>返回首页</Button>
                </Link>
            </div>

            <div className="mb-6">
                <Card title="项目数据看板 (Project Dashboard)" size="small">
                    <Row gutter={16}>
                        <Col span={8}>
                            <Statistic title="当前项目个数" value={projects.length} prefix={<FolderOutlined />} />
                        </Col>
                        {/* You can add more global stats here if needed, e.g. Total Materials across all projects */}
                    </Row>
                </Card>
            </div>

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">项目档案库 (Project Archive)</h1>
                {user?.role === 'ADMIN' && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                        新建项目
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {projects.map((p: any) => {
                    const materialCount = p.archiveItems?.length || 0;
                    const manufacturerCount = new Set(p.archiveItems?.map((i: any) => i.masterMaterial?.manufacturerId).filter(Boolean)).size;
                    
                    const isApproved = p.membershipStatus === 'APPROVED';
                    const isPending = p.membershipStatus === 'PENDING';
                    
                    const cardContent = (
                        <Card.Meta
                            avatar={<FolderOutlined className={`text-2xl ${isApproved ? 'text-yellow-500' : 'text-gray-400'}`} />}
                            title={p.name}
                            description={
                                <div>
                                    <p>{p.code}</p>
                                    <div className="flex space-x-4 my-2">
                                        <span className="text-gray-600 flex items-center" title="物料个数">
                                            <FileTextOutlined className="mr-1" /> {materialCount}
                                        </span>
                                        <span className="text-gray-600 flex items-center" title="厂家个数">
                                            <ShopOutlined className="mr-1" /> {manufacturerCount}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400">Created: {dayjs(p.createdAt).format('YYYY-MM-DD')}</p>
                                    <p className="text-gray-500 mt-2 text-sm line-clamp-2">{p.description}</p>
                                </div>
                            }
                        />
                    );

                    return (
                    <Card 
                        key={p.id} 
                        hoverable={isApproved} 
                        className="h-full relative group"
                        actions={user?.role === 'ADMIN' ? [
                            <EditOutlined key="edit" onClick={(e) => { e.preventDefault(); openModal(p); }} />,
                            <DeleteOutlined key="delete" onClick={(e) => { e.preventDefault(); handleDelete(p.id); }} style={{ color: 'red' }} />
                        ] : []}
                    >
                        {isApproved ? (
                            <Link href={`/archive/${p.id}`} className="block h-full">
                                {cardContent}
                            </Link>
                        ) : (
                            <div className="h-full flex flex-col justify-between">
                                {cardContent}
                                <div className="mt-4 text-center">
                                    {isPending ? (
                                        <Button disabled type="dashed" block>
                                            权限审核中
                                        </Button>
                                    ) : (
                                        <Button type="primary" block onClick={() => handleRequestAccess(p.id)}>
                                            申请项目权限
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </Card>
                    );
                })}
            </div>

            <Modal 
                title={editingProject ? "编辑项目" : "新建项目"} 
                open={isModalOpen} 
                onCancel={() => setIsModalOpen(false)} 
                onOk={form.submit}
            >
                <Form form={form} onFinish={handleCreateOrUpdate} layout="vertical">
                    <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="code" label="项目编号">
                        <Input />
                    </Form.Item>
                    <Form.Item name="description" label="项目描述">
                        <Input.TextArea rows={4} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
