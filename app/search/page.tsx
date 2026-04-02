'use client';

import React, { useState, useEffect } from 'react';
import { Table, Input, Form, Button, Tag, Card, Select, Checkbox, Space, Tooltip, Modal, Descriptions, message, Popconfirm, Switch } from 'antd';
import { EyeOutlined, DownloadOutlined, SwapOutlined, DeleteOutlined, InfoCircleOutlined, BulbOutlined, HomeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import UploadModal from '../components/UploadModal';
import MaterialCodeSelect, { type MaterialCodeItem } from '../components/MaterialCodeSelect';

const { Option } = Select;

const MANUFACTURER_ROLES = ["生产厂家", "供应商", "组装厂"];  


// Define Document Types for Filtering
const MANUFACTURER_TYPES = ['LICENSE', 'ISO_QUALITY', 'ISO_SAFETY', 'ISO_ENV'];
const PRODUCT_TYPES = ['CERTIFICATE', 'TYPE_REPORT'];

const DOC_TYPE_LABELS: Record<string, string> = {
    'LICENSE': '营业执照',
    'ISO_QUALITY': '质量管理体系认证证书',
    'ISO_SAFETY': '安全管理体系认证证书',
    'ISO_ENV': '环境管理体系认证证书',
    'CERTIFICATE': '产品合格证',
    'TYPE_REPORT': '产品型式检验报告'
};

export default function SearchPage() {
    const { user } = useAuth();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [advancedSearch, setAdvancedSearch] = useState(false);
    const [selectedMaterialCode, setSelectedMaterialCode] = useState<MaterialCodeItem | null>(null);
    
    // Details Modal State
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [currentDetail, setCurrentDetail] = useState<any>(null);

    // Replace Modal State
    const [replaceModalOpen, setReplaceModalOpen] = useState(false);
    const [targetDoc, setTargetDoc] = useState<any>(null);

    const onFinish = async (values: any) => {
        setLoading(true);
        const params = new URLSearchParams();
        if (values.q) params.append('q', values.q);
        if (values.country) params.append('country', values.country);
        if (values.manufacturer) params.append('manufacturer', values.manufacturer);
        if (values.material) params.append('material', values.material);
        if (selectedMaterialCode?.code) params.append('materialCode', selectedMaterialCode.code);
        if (values.model) params.append('model', values.model);
        
        if (selectedRoles.length > 0) {
            params.append('manufacturerRoles', selectedRoles.join(','));
        }

        if (advancedSearch) {
            params.append('advanced', 'true');
        }

        // Handle Category Filtering
        if (selectedCategories.length > 0) {
            const types: string[] = [];
            if (selectedCategories.includes('MANUFACTURER')) {
                types.push(...MANUFACTURER_TYPES);
            }
            if (selectedCategories.includes('PRODUCT')) {
                types.push(...PRODUCT_TYPES);
            }
            if (types.length > 0) {
                params.append('types', types.join(','));
            }
        }

        try {
            const res = await fetch(`/api/search?${params.toString()}`);
            const json = await res.json();
            if (json.success) {
                setData(json.data);
            }
        } catch (e) {
            console.error(e);
            message.error("检索失败");
        } finally {
            setLoading(false);
        }
    };

    // Initial Search
    useEffect(() => {
        const fetchInitialData = async () => {
            await onFinish({});
        };
        fetchInitialData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCategories, selectedRoles]); // Re-search when category/role changes

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                message.success('删除成功');
                onFinish(form.getFieldsValue()); // Refresh
            } else {
                message.error('删除失败: ' + json.message);
            }
        } catch (e) {
            message.error('删除出错');
        }
    };

    const handleReplace = (record: any) => {
        setTargetDoc(record);
        setReplaceModalOpen(true);
    };

    const handleReplaceSuccess = () => {
        setReplaceModalOpen(false);
        setTargetDoc(null);
        // message.success is handled in UploadModal for replace success
        onFinish(form.getFieldsValue()); // Refresh table
    };

    const showDetails = (record: any) => {
        let parsed = {};
        try {
            parsed = JSON.parse(record.parsedMeta || '{}');
        } catch (e) {}
        setCurrentDetail({ ...record, parsedObj: parsed });
        setDetailModalOpen(true);
    };

    const renderHighlightedText = (text: string) => {
        if (!text) return null;
        // Split by **text** markers
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <span key={i} className="bg-yellow-200 font-bold px-1 rounded text-red-600">{part.slice(2, -2)}</span>;
            }
            return <span key={i}>{part}</span>;
        });
    };
    const columns = [
        { 
            title: '文件名称', 
            dataIndex: 'fileName', 
            key: 'fileName',
            width: 180,
            align: 'left' as const,
            className: 'text-left',
            ellipsis: {
                showTitle: false,
            },
            render: (text: string) => (
                <Tooltip 
                    title={text}
                    placement="topLeft"
                    getPopupContainer={() => document.body}
                >
                    <span
                      className="inline-block max-w-full"
                      style={{ textAlign: 'left', width: '100%' }}
                    >
                      {text}
                    </span>
                </Tooltip>
            )
        },
        { 
            title: '类型', 
            dataIndex: 'type', 
            key: 'type', 
            width: 120,
            render: (t: string) => <Tag>{DOC_TYPE_LABELS[t] || t}</Tag> 
        },
        { 
            title: '厂家', 
            dataIndex: ['manufacturer', 'name'], 
            key: 'manufacturer', 
            width: 180,
            ellipsis: true,
            render: (t: string) => (
                <Tooltip title={t}>
                    {t || '-'}
                </Tooltip>
            )
        },
        { 
            title: '厂家角色', 
            dataIndex: 'manufacturerRole', 
            key: 'manufacturerRole', 
            width: 150,
            render: (t: string) => {
                if (!t) return '-';
                const roles = t.split(',');
                return (
                    <Space size={[0, 4]} wrap>
                        {roles.map(role => (
                            <Tag key={role} color="blue">{role}</Tag>
                        ))}
                    </Space>
                );
            }
        },
        { 
            title: '国别', 
            dataIndex: ['manufacturer', 'country'], 
            key: 'country', 
            width: 100,
            ellipsis: true,
            render: (t: string) => t || '-' 
        },
        {
            title: '物料编码',
            key: 'materialCode',
            width: 120,
            ellipsis: true,
            render: (_: any, record: any) => record.masterMaterial?.materialCode || '-',
        },
        { 
            title: '物料名称', 
            dataIndex: ['masterMaterial', 'name'], 
            key: 'material', 
            width: 120,
            ellipsis: true,
            render: (t: string) => (
                <Tooltip title={t}>
                    {t || '-'}
                </Tooltip>
            )
        },
        {
            title: '规格型号',
            key: 'model',
            width: 150, 
            ellipsis: true,
            render: (_: any, record: any) => {
                // If it's a Manufacturer Credential, show '-'
                if (MANUFACTURER_TYPES.includes(record.type)) {
                    return '-';
                }
                // For Product Materials, try to get model from relation or parsedMeta
                let model = record.masterMaterial?.model;
                if (!model && record.parsedMeta) {
                    try {
                        const meta = JSON.parse(record.parsedMeta);
                        model = meta.model;
                    } catch {}
                }
                
                if (!model) return '-';

                return (
                    <Tooltip title={model}>
                        {model}
                    </Tooltip>
                );
            }
        },
        { 
            title: '有效期', 
            dataIndex: 'expiryDate', 
            key: 'expiryDate',
            width: 120,
            render: (date: string, record: any) => {
                // Only show for relevant types (e.g. ISO certs)
                // Also show for LICENSE if available
                if (!['ISO_QUALITY', 'ISO_SAFETY', 'ISO_ENV', 'LICENSE'].includes(record.type)) {
                    return '-';
                }

                // If date is null/undefined, try to read from parsedMeta
                let displayDate = date;
                if (!displayDate && record.parsedMeta) {
                    try {
                        const meta = JSON.parse(record.parsedMeta);
                        displayDate = meta.expiryDate;
                    } catch {}
                }

                if (!displayDate) return '-';
                
                // If "长期" is present, it's valid forever
                if (displayDate.includes('长期')) {
                    return <span className="text-green-600">{displayDate}</span>;
                }

                // Try to parse different date formats
                // 1. Standard YYYY-MM-DD
                let d = dayjs(displayDate);
                
                // 2. Range format "YYYY年MM月DD日至YYYY年MM月DD日" or similar
                // We extract the end date part
                if (!d.isValid()) {
                    // Extract potential date strings using regex
                    // Matches YYYY-MM-DD, YYYY/MM/DD, YYYY年MM月DD日
                    const dateMatches = displayDate.match(/(\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}日?)/g);
                    if (dateMatches && dateMatches.length > 0) {
                        // Take the last date found as the expiry date
                        let lastDateStr = dateMatches[dateMatches.length - 1];
                        // Replace Chinese chars to standard format for parsing
                        lastDateStr = lastDateStr.replace(/年|月/g, '-').replace(/日/g, '');
                        d = dayjs(lastDateStr);
                    }
                }

                if (d.isValid()) {
                    const isExpired = d.isBefore(dayjs());
                    return (
                        <Tooltip title={isExpired ? '已过期' : '有效期内'}>
                            <span className={isExpired ? 'text-red-500 font-bold' : 'text-green-600'}>
                                {displayDate} {isExpired && '(已过期)'}
                            </span>
                        </Tooltip>
                    );
                }
                
                // If it's a raw string like "长期" or unparseable range
                return <span>{displayDate}</span>;
            }
        },
        {
            title: '操作',
            key: 'action',
            width: 250,
            render: (_: any, record: any) => (
                <Space size="small">
                    <Tooltip title="查看">
                        <Button 
                            type="text" 
                            icon={<EyeOutlined />} 
                            onClick={() => window.open(record.filePath, '_blank')} 
                        />
                    </Tooltip>
                    <Tooltip title="下载">
                        <a href={record.filePath} download>
                            <Button type="text" icon={<DownloadOutlined />} />
                        </a>
                    </Tooltip>
                    <Tooltip title="详情">
                        <Button type="text" icon={<InfoCircleOutlined />} onClick={() => showDetails(record)} />
                    </Tooltip>
                    {/* Replace functionality */}
                    {user?.role === 'ADMIN' && (
                        <>
                            <Tooltip title="替换">
                                <Button 
                                    type="text" 
                                    icon={<SwapOutlined />} 
                                    onClick={() => handleReplace(record)} 
                                /> 
                            </Tooltip>
                            <Tooltip title="删除">
                                <Popconfirm title="确定要删除此文件吗？" onConfirm={() => handleDelete(record.id)}>
                                    <Button type="text" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </Tooltip>
                        </>
                    )}
                </Space>
            )
        }
    ];

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">全局检索 (Global Search)</h1>
                <Link href="/">
                    <Button icon={<HomeOutlined />}>返回首页</Button>
                </Link>
            </div>
            
            <Card className="mb-6 shadow-sm">
                <div className="mb-4">
                    <span className="mr-4 font-bold">资料类型:</span>
                    <Checkbox.Group 
                        options={[
                            { label: '厂家资质证书类', value: 'MANUFACTURER' },
                            { label: '物料类', value: 'PRODUCT' }
                        ]}
                        value={selectedCategories}
                        onChange={(vals) => setSelectedCategories(vals as string[])}
                    />
                </div>
                
                <Form form={form} layout="inline" onFinish={onFinish}>
                    <Form.Item name="q" label="关键词" style={{ marginBottom: 12 }}>
                        <Input placeholder="Search..." allowClear />
                    </Form.Item>
                    <Form.Item name="country" label="国别" style={{ marginBottom: 12 }}>
                        <Input placeholder="Country" allowClear />
                    </Form.Item>
                    <Form.Item name="manufacturer" label="厂家" style={{ marginBottom: 12 }}>
                        <Input placeholder="Manufacturer" allowClear />
                    </Form.Item>
                    <Form.Item label="物料编码" style={{ minWidth: 260, marginBottom: 12 }}>
                        <MaterialCodeSelect
                            value={selectedMaterialCode}
                            onChange={setSelectedMaterialCode}
                            placeholder="输入编码/名称并选择"
                        />
                    </Form.Item>
                    <Form.Item name="material" label="物料名称" style={{ marginBottom: 12 }}>
                        <Input placeholder="Material" allowClear />
                    </Form.Item>
                    <Form.Item name="model" label="规格型号" style={{ marginBottom: 12 }}>
                        <Input placeholder="Model/Spec" allowClear />
                    </Form.Item>
                    <Form.Item label="厂家角色" style={{ minWidth: 200, marginBottom: 12 }}>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="选择厂家角色"
                            value={selectedRoles}
                            onChange={setSelectedRoles}
                            maxTagCount="responsive"
                        >
                            {MANUFACTURER_ROLES.map(role => (
                                <Option key={role} value={role}>{role}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item label="高级检索" style={{ marginBottom: 12 }}>
                        <Switch 
                            checked={advancedSearch} 
                            onChange={setAdvancedSearch} 
                            checkedChildren={<Space><BulbOutlined /> 开启</Space>}
                            unCheckedChildren="关闭"
                        />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 12 }}>
                        <Button type="primary" htmlType="submit" loading={loading}>Search</Button>
                    </Form.Item>
                </Form>
            </Card>
            
            <Table 
                columns={columns} 
                dataSource={data} 
                rowKey="id" 
                loading={loading} 
                pagination={{ pageSize: 10 }}
                expandable={{
                    expandedRowRender: (record: any) => (
                        <div className="p-4 bg-blue-50 rounded-md">
                            <Descriptions title="语义检索匹配详情" size="small" column={1}>
                                {record.llmRelevant && (
                                    <Descriptions.Item label="LLM 智能筛选">
                                        <Tag color="green" icon={<BulbOutlined />}>高度相关</Tag>
                                    </Descriptions.Item>
                                )}
                                {record.llmReasoning && (
                                    <Descriptions.Item label="AI 分析与高亮">
                                        <div className="p-2 bg-white rounded border border-green-200 text-gray-800">
                                            {renderHighlightedText(record.llmReasoning)}
                                        </div>
                                    </Descriptions.Item>
                                )}
                                <Descriptions.Item label="匹配片段">
                                    <div className="whitespace-pre-wrap font-mono text-gray-700 max-h-60 overflow-y-auto">
                                        {record.matchedFragment}
                                    </div>
                                </Descriptions.Item>
                                {record.relevanceScore !== undefined && (
                                <Descriptions.Item label={record.relevanceScore >= 1 && Number.isInteger(record.relevanceScore) ? "相关性排名" : "相关度分数"}>
                                {record.relevanceScore >= 1 && Number.isInteger(record.relevanceScore) 
                                ? <span className="font-bold text-blue-600">第 {record.relevanceScore} 名</span> 
                                : record.relevanceScore.toFixed(4)
                                }
                                </Descriptions.Item>
                                )}
                            </Descriptions>
                        </div>
                    ),
                    rowExpandable: (record: any) => !!record.matchedFragment,
                    showExpandColumn: false,
                }}
            />

            <Modal 
                title="文件详情" 
                open={detailModalOpen} 
                onCancel={() => setDetailModalOpen(false)}
                footer={null}
                width={600}
            >
                {currentDetail && (
                    <Descriptions bordered column={1}>
                        <Descriptions.Item label="文件名称">{currentDetail.fileName}</Descriptions.Item>
                        <Descriptions.Item label="类型">{DOC_TYPE_LABELS[currentDetail.type] || currentDetail.type}</Descriptions.Item>
                        <Descriptions.Item label="厂家">{currentDetail.manufacturer?.name || '-'}</Descriptions.Item>
                        {currentDetail.manufacturerRole && (
                            <Descriptions.Item label="厂家角色">
                                <Space size={[0, 4]} wrap>
                                    {currentDetail.manufacturerRole.split(',').map((role: string) => (
                                        <Tag key={role} color="blue">{role}</Tag>
                                    ))}
                                </Space>
                            </Descriptions.Item>
                        )}
                        <Descriptions.Item label="物料">{currentDetail.masterMaterial?.name || '-'}</Descriptions.Item>
                        
                        {MANUFACTURER_TYPES.includes(currentDetail.type) && (
                            <Descriptions.Item label="证书有效期">{currentDetail.parsedObj?.expiryDate || '-'}</Descriptions.Item>
                        )}

                        {PRODUCT_TYPES.includes(currentDetail.type) && (
                            <>
                                <Descriptions.Item label="规格型号">{currentDetail.parsedObj?.model || '-'}</Descriptions.Item>
                                <Descriptions.Item label="报告日期">{currentDetail.parsedObj?.reportDate || '-'}</Descriptions.Item>
                            </>
                        )}

                        <Descriptions.Item label="解析元数据">
                            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-48">
                                {JSON.stringify(currentDetail.parsedObj, null, 2)}
                            </pre>
                        </Descriptions.Item>
                        <Descriptions.Item label="上传时间">{dayjs(currentDetail.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>

            {/* Replace Modal */}
            {replaceModalOpen && (
                <UploadModal
                    visible={replaceModalOpen}
                    onCancel={() => {
                        setReplaceModalOpen(false);
                        setTargetDoc(null);
                    }}
                    onSuccess={handleReplaceSuccess}
                    initialDocType={targetDoc ? { key: targetDoc.type, label: DOC_TYPE_LABELS[targetDoc.type] || targetDoc.type } : null}
                    isReplace={true}
                    replaceTargetId={targetDoc?.id}
                />
            )}
        </div>
    );
}