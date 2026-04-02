'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, Button, List, Modal, Upload, message, Collapse, Tag, Space, Tooltip, Form, Input, Table, Popconfirm, Row, Col, Checkbox, Switch, Select } from 'antd';
import { PlusOutlined, UploadOutlined, SearchOutlined, DownloadOutlined, DeleteOutlined, InfoCircleOutlined, EyeOutlined, ExportOutlined, EditOutlined } from '@ant-design/icons';
import { useParams } from 'next/navigation';
import MaterialCodeSelect, { type MaterialCodeItem } from '../../components/MaterialCodeSelect';

const { Panel } = Collapse;
const { Option } = Select;

// Reuse document type labels
const DOC_TYPE_LABELS: Record<string, string> = {
    'LICENSE': '营业执照',
    'ISO_QUALITY': '质量管理体系认证证书',
    'ISO_SAFETY': '安全管理体系认证证书',
    'ISO_ENV': '环境管理体系认证证书',
    'CERTIFICATE': '产品合格证',
    'TYPE_REPORT': '产品型式检验报告',
    'SAMPLE_SEALING_FORM': '封样单'
};

const MANUFACTURER_ROLES = ["生产厂家", "供应商", "组装厂"];

export default function ProjectDetailsPage() {
    const params = useParams();
    const [project, setProject] = useState<any>(null);
    const [materials, setMaterials] = useState<any[]>([]);
    
    // Add New Material Modal (Create empty)
    const [isCreateMaterialModalOpen, setIsCreateMaterialModalOpen] = useState(false);
    const [createMaterialForm] = Form.useForm();
    const [createLoading, setCreateLoading] = useState(false);
    const [createSelectedMaterialCode, setCreateSelectedMaterialCode] = useState<MaterialCodeItem | null>(null);

    // Rename Material Modal
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [renameForm] = Form.useForm();
    const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
    const [renameSelectedMaterialCode, setRenameSelectedMaterialCode] = useState<MaterialCodeItem | null>(null);

    // Add Document Search Modal
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchForm] = Form.useForm();
    const [targetMaterialId, setTargetMaterialId] = useState<string | null>(null);
    const [targetArchiveItemId, setTargetArchiveItemId] = useState<string | null>(null);
    const [advancedSearch, setAdvancedSearch] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [searchSelectedMaterialCode, setSearchSelectedMaterialCode] = useState<MaterialCodeItem | null>(null);
    
    // Detail Modal
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [currentDetail, setCurrentDetail] = useState<any>(null);

    const projectId = Array.isArray(params.id) ? params.id[0] : params.id;

    const fetchProject = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}`);
            if (res.ok) {
                const json = await res.json();
                setProject(json);
                setMaterials(json.archiveItems || []);
            } else if (res.status === 403) {
                 message.error("您没有权限访问该项目");
                 window.location.href = '/archive';
            } else {
                 message.error("加载项目失败");
            }
        } catch (e) {
            message.error("加载出错");
        }
    }, [projectId]);

    useEffect(() => {
        if (projectId) {
            fetchProject();
        }
    }, [fetchProject, projectId]);

    // --- Step 1: Create New Material ---

    const handleCreateMaterial = async (values: any) => {
        setCreateLoading(true);
        try {
            if (!createSelectedMaterialCode?.code) {
                message.error('请选择物料编码');
                setCreateLoading(false);
                return;
            }
            const res = await fetch(`/api/projects/${projectId}/items`, {
                method: 'POST',
                body: JSON.stringify({
                    materialCode: createSelectedMaterialCode.code,
                    manufacturerName: values.manufacturerName
                })
            });
            
            if (res.ok) {
                message.success('已新建物料');
                setIsCreateMaterialModalOpen(false);
                createMaterialForm.resetFields();
                setCreateSelectedMaterialCode(null);
                fetchProject();
            } else {
                message.error('创建失败');
            }
        } catch (e) {
            message.error("系统错误");
        } finally {
            setCreateLoading(false);
        }
    };

    // --- Rename Material ---
    const openRenameModal = (itemId: string, currentName: string, currentManufacturerName: string) => {
        setRenameTargetId(itemId);
        renameForm.setFieldsValue({ 
            manufacturerName: currentManufacturerName 
        });
        setRenameSelectedMaterialCode(null);
        setIsRenameModalOpen(true);
    };

    const handleRenameMaterial = async (values: any) => {
        if (!renameTargetId) return;
        try {
            const payload: any = {
                manufacturerName: values.manufacturerName
            };
            if (renameSelectedMaterialCode?.code) {
                payload.materialCode = renameSelectedMaterialCode.code;
            } else if (values.materialName) {
                payload.materialName = values.materialName;
            }
            const res = await fetch(`/api/projects/${projectId}/items/${renameTargetId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                message.success('编辑成功');
                setIsRenameModalOpen(false);
                setRenameSelectedMaterialCode(null);
                fetchProject();
            } else {
                message.error('编辑失败');
            }
        } catch (e) {
            message.error("系统错误");
        }
    };

    // --- Step 3: Add Documents via Global Search ---

    const openSearchForMaterial = (masterMaterialId: string, archiveItemId: string) => {
        setTargetMaterialId(masterMaterialId);
        setTargetArchiveItemId(archiveItemId);
        setSearchResults([]);
        setIsSearchModalOpen(true);
    };

    // Define Document Types for Filtering (Consistent with SearchPage)
    const MANUFACTURER_TYPES = ['LICENSE', 'ISO_QUALITY', 'ISO_SAFETY', 'ISO_ENV'];
    const PRODUCT_TYPES = ['CERTIFICATE', 'TYPE_REPORT'];

    const handleSearch = async (values: any) => {
        setSearchLoading(true);
        const params = new URLSearchParams();
        if (values.q) params.append('q', values.q);
        if (values.country) params.append('country', values.country);
        if (values.manufacturer) params.append('manufacturer', values.manufacturer);
        if (values.material) params.append('material', values.material);
        if (values.model) params.append('model', values.model);
        if (searchSelectedMaterialCode?.code) params.append('materialCode', searchSelectedMaterialCode.code);
        
        if (selectedRoles.length > 0) {
            params.append('manufacturerRoles', selectedRoles.join(','));
        }

        if (advancedSearch) {
            params.append('advanced', 'true');
        }

        const categories = values.categories || [];
        if (categories.length > 0) {
            const types: string[] = [];
            if (categories.includes('MANUFACTURER')) {
                types.push(...MANUFACTURER_TYPES);
            }
            if (categories.includes('PRODUCT')) {
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
                setSearchResults(json.data);
            }
        } catch (e) {
            message.error("检索失败");
        } finally {
            setSearchLoading(false);
        }
    };

    const handleAddDocumentToMaterial = async (sourceDoc: any) => {
        // Use the current archiveItem ID (which we need to find from the context or pass in)
        // Wait, 'targetMaterialId' is global material ID. We need the archiveItem ID.
        // In the render function below, we have 'item.id' which is the archiveItemId.
        // But this function uses 'targetMaterialId' state which is set when opening the modal.
        
        // We need to store the target archiveItem ID in state as well.
        if (!targetArchiveItemId) return;

        try {
            // Use the new Reference API
            const res = await fetch(`/api/projects/archive/${targetArchiveItemId}/reference`, {
                method: 'POST',
                body: JSON.stringify({ sourceDocumentId: sourceDoc.id })
            });
            
            if (res.ok) {
                message.success('已添加证书到项目档案');
                fetchProject();
                // Optional: Close modal or keep open for more adds
            } else {
                message.error('添加失败');
            }
        } catch (e) {
            message.error("系统错误");
        }
    };

    // --- File Operations ---

    const handleUploadSample = async (archiveItemId: string, file: any) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'SAMPLE_SEALING_FORM');
        formData.append('archiveItemId', archiveItemId);

        const res = await fetch('/api/upload/project', { method: 'POST', body: formData });
        if (res.ok) {
            message.success('上传成功');
            fetchProject();
        } else {
            message.error('上传失败');
        }
    };

    // Delete Document (Copied version) from Material
    const handleDeleteMaterialDoc = async (docId: string, isProjectDoc: boolean) => {
        try {
            const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
            if (res.ok) {
                message.success("证书已移除");
                fetchProject();
            } else {
                message.error("删除失败");
            }
        } catch (e) {
            message.error("系统错误");
        }
    };

    const handleRemoveItem = async (itemId: string) => {
        try {
            const res = await fetch(`/api/projects/${projectId}/items/${itemId}`, { method: 'DELETE' });
            if (res.ok) {
                message.success("已移除物料");
                fetchProject();
            } else {
                const data = await res.json().catch(() => ({}));
                message.error(data.error || "移除失败");
            }
        } catch (e) {
            message.error("系统错误");
        }
    };

    const handleDeleteProjectDoc = async (docId: string) => {
        try {
            const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
            if (res.ok) {
                message.success("文件已删除");
                fetchProject();
            } else {
                message.error("删除失败");
            }
        } catch (e) {
            message.error("系统错误");
        }
    };

    const handleExportProject = async () => {
        try {
            message.loading({ content: '正在打包导出...', key: 'export' });
            const res = await fetch(`/api/projects/${projectId}/export`);
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${project.name}-资料包.zip`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                message.success({ content: '导出成功', key: 'export' });
            } else {
                message.error({ content: '导出失败', key: 'export' });
            }
        } catch (e) {
            message.error({ content: '导出出错', key: 'export' });
        }
    };

    const showDocDetails = (doc: any) => {
        let parsed = {};
        try { parsed = JSON.parse(doc.parsedMeta || '{}'); } catch (e) {}
        setCurrentDetail({ ...doc, parsedObj: parsed });
        setDetailModalOpen(true);
    };

    // --- Columns for Search Modal ---
    const searchColumns = [
        { 
            title: '文件名称',
            dataIndex: 'fileName',
            key: 'fileName',
            width: 180,
            align: 'left' as const,
            className: 'text-left',
            ellipsis: { showTitle: false },
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
            ),
        },
        { title: '类型', dataIndex: 'type', key: 'type', width: 120, render: (t: string) => <Tag>{DOC_TYPE_LABELS[t] || t}</Tag> },
        { title: '厂家', dataIndex: ['manufacturer', 'name'], key: 'manuf', width: 150, ellipsis: true },
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
        { title: '国别', dataIndex: ['manufacturer', 'country'], key: 'country', width: 100 },
        {
            title: '物料编码',
            key: 'materialCode',
            width: 120,
            ellipsis: true,
            render: (_: any, record: any) => record.masterMaterial?.materialCode || '-',
        },
        { title: '物料名称', dataIndex: ['masterMaterial', 'name'], key: 'mat', width: 120, ellipsis: true },
        { 
            title: '规格型号', 
            key: 'model', 
            width: 150,
            ellipsis: true,
            render: (_: any, record: any) => {
                let model = record.masterMaterial?.model;
                if (!model && record.parsedMeta) {
                    try {
                        const meta = JSON.parse(record.parsedMeta);
                        model = meta.model;
                    } catch {}
                }
                return model || '-';
            }
        },
        { 
            title: '操作', 
            key: 'action', 
            width: 150,
            render: (_: any, record: any) => (
                <Space>
                     <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => window.open(record.filePath, '_blank')}>查看</Button>
                     <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => handleAddDocumentToMaterial(record)}>添加</Button>
                </Space>
            )
        }
    ];

    if (!project) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-8">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold mb-2">{project.name}</h1>
                    <p className="text-gray-500">{project.code}</p>
                    <p className="text-gray-600 mt-2">{project.description}</p>
                </div>
                <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateMaterialModalOpen(true)}>
                        新建物料
                    </Button>
                    <Button icon={<ExportOutlined />} onClick={handleExportProject}>
                        导出资料包
                    </Button>
                </Space>
            </div>

            <Collapse defaultActiveKey={['0']}>
                {materials.map((item: any) => (
                    <Panel 
                        header={
                            <div className="flex justify-between items-center w-full pr-4">
                                <span>{item.masterMaterial.materialCode} - {item.masterMaterial.name} - {item.masterMaterial.manufacturer.name}</span>
                                <Space onClick={(e) => e.stopPropagation()}>
                                    <Tooltip title="编辑物料名称">
                                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openRenameModal(item.id, item.masterMaterial.name, item.masterMaterial.manufacturer.name)} />
                                    </Tooltip>
                                    <Popconfirm title="确定移除该物料?" onConfirm={() => handleRemoveItem(item.id)}>
                                        <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                </Space>
                            </div>
                        } 
                        key={item.id}
                        extra={<Tag color={item.status === 'PENDING' ? 'orange' : 'green'}>{item.status}</Tag>}
                    >
                        <Row gutter={16}>
                            {/* LEFT COLUMN: Manufacturer & Product Certs */}
                            <Col span={14}>
                                <Card 
                                    title="厂家资质与产品证书" 
                                    size="small" 
                                    extra={
                                        <Button type="link" icon={<PlusOutlined />} onClick={() => openSearchForMaterial(item.masterMaterial.id, item.id)}>
                                            添加证书
                                        </Button>
                                    }
                                >
                                    <List
                                        dataSource={[
                                            ...(item.masterMaterial.documents || []).map((d: any) => ({ ...d, isGlobal: true })),
                                            ...(item.documents || []).filter((d: any) => d.type !== 'SAMPLE_SEALING_FORM').map((d: any) => ({ ...d, isGlobal: false }))
                                        ]}
                                        renderItem={(doc: any, index: number) => (
                                            <List.Item
                                                key={doc.id || index}
                                                actions={[
                                                    <Button key="view" type="text" icon={<EyeOutlined />} onClick={() => window.open(doc.filePath, '_blank')} />,
                                                    <Button key="dl" type="text" icon={<DownloadOutlined />} href={doc.filePath} download />,
                                                    !doc.isGlobal && (
                                                        <Popconfirm key="del-confirm" title="确定删除?" onConfirm={() => handleDeleteMaterialDoc(doc.id, false)}>
                                                            <Button key="del" type="text" danger icon={<DeleteOutlined />} />
                                                        </Popconfirm>
                                                    )
                                                ]}
                                            >
                                                <div className="flex flex-col">
                                                    <div className="flex items-center">
                                                        <div className="font-medium truncate mr-2" style={{maxWidth: '250px'}} title={doc.fileName}>{doc.fileName}</div>
                                                        {doc.isGlobal && <Tag style={{fontSize: '10px', lineHeight: '16px', height: '18px', padding: '0 4px'}}>全局</Tag>}
                                                    </div>
                                                    <span className="text-xs text-gray-400">{DOC_TYPE_LABELS[doc.type] || doc.type}</span>
                                                </div>
                                            </List.Item>
                                        )}
                                        locale={{ emptyText: '暂无证书，请点击右上角添加' }}
                                    />
                                </Card>
                            </Col>

                            {/* RIGHT COLUMN: Sample Form */}
                            <Col span={10}>
                                <Card title="封样单 (项目专用)" size="small" extra={
                                    <Upload 
                                        showUploadList={false} 
                                        beforeUpload={(f) => { handleUploadSample(item.id, f); return false; }}
                                    >
                                        <Button size="small" icon={<UploadOutlined />}>上传</Button>
                                    </Upload>
                                }>
                                    <List
                                        dataSource={(item.documents || []).filter((d: any) => d.type === 'SAMPLE_SEALING_FORM')}
                                        renderItem={(doc: any, index: number) => (
                                            <List.Item
                                                key={doc.id || index}
                                                actions={[
                                                    <Button key="view" type="text" icon={<EyeOutlined />} onClick={() => window.open(doc.filePath, '_blank')} />,
                                                    <Button key="dl" type="text" icon={<DownloadOutlined />} href={doc.filePath} download />,
                                                    <Popconfirm key="del-confirm" title="确定删除?" onConfirm={() => handleDeleteProjectDoc(doc.id)}>
                                                        <Button key="del" type="text" danger icon={<DeleteOutlined />} />
                                                    </Popconfirm>
                                                ]}
                                            >
                                                <div className="flex flex-col">
                                                    <div className="font-medium truncate" style={{maxWidth: '200px'}} title={doc.fileName}>{doc.fileName}</div>
                                                    <span className="text-xs text-gray-400">{DOC_TYPE_LABELS[doc.type] || doc.type}</span>
                                                </div>
                                            </List.Item>
                                        )}
                                        locale={{ emptyText: '暂无封样单' }}
                                    />
                                </Card>
                            </Col>
                        </Row>
                    </Panel>
                ))}
            </Collapse>

            {/* Step 1: Create Material Modal */}
            <Modal
                title="新建物料"
                open={isCreateMaterialModalOpen}
                onCancel={() => setIsCreateMaterialModalOpen(false)}
                onOk={createMaterialForm.submit}
                confirmLoading={createLoading}
            >
                <Form form={createMaterialForm} layout="vertical" onFinish={handleCreateMaterial}>
                    <Form.Item label="物料编码/名称" required>
                        <MaterialCodeSelect
                            value={createSelectedMaterialCode}
                            onChange={setCreateSelectedMaterialCode}
                            placeholder="输入物料编码或名称搜索并选择"
                        />
                    </Form.Item>
                    <Form.Item name="manufacturerName" label="厂家名称" rules={[{ required: true }]}>
                        <Input placeholder="请输入厂家名称" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Rename Modal */}
            <Modal
                title="编辑物料信息"
                open={isRenameModalOpen}
                onCancel={() => setIsRenameModalOpen(false)}
                onOk={renameForm.submit}
            >
                <Form form={renameForm} layout="vertical" onFinish={handleRenameMaterial}>
                    <Form.Item label="物料编码/名称">
                        <MaterialCodeSelect
                            value={renameSelectedMaterialCode}
                            onChange={setRenameSelectedMaterialCode}
                            placeholder="输入物料编码或名称搜索并选择（不选则保持/用下方手填）"
                        />
                    </Form.Item>
                    <Form.Item name="materialName" label="物料名称（手动）">
                        <Input placeholder="不选择编码时可手动修改名称" />
                    </Form.Item>
                    <Form.Item name="manufacturerName" label="厂家名称" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Step 3: Search Modal */}
            <Modal 
                title="添加证书 - 全局检索" 
                open={isSearchModalOpen} 
                onCancel={() => setIsSearchModalOpen(false)} 
                footer={null}
                width={1000}
            >
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <div>
                            <span className="mr-4 font-bold">资料类型:</span>
                            <Checkbox.Group 
                                options={[
                                    { label: '厂家资质证书类', value: 'MANUFACTURER' },
                                    { label: '物料类', value: 'PRODUCT' }
                                ]}
                                onChange={(vals) => searchForm.setFieldValue('categories', vals)}
                            />
                        </div>
                        <Space>
                            <span className="text-gray-500 text-sm">高级检索:</span>
                            <Switch checked={advancedSearch} onChange={setAdvancedSearch} />
                        </Space>
                    </div>
                </div>

                <Form form={searchForm} layout="inline" onFinish={handleSearch} className="mb-4">
                    <Form.Item name="categories" hidden><Input /></Form.Item>
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
                            value={searchSelectedMaterialCode}
                            onChange={setSearchSelectedMaterialCode}
                            placeholder="输入编码/名称并选择"
                        />
                    </Form.Item>
                    <Form.Item name="material" label="物料" style={{ marginBottom: 12 }}>
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
                    <Form.Item style={{ marginBottom: 12 }}>
                        <Button type="primary" htmlType="submit" loading={searchLoading} icon={<SearchOutlined />}>检索</Button>
                    </Form.Item>
                </Form>
                
                <Table 
                    columns={searchColumns} 
                    dataSource={searchResults} 
                    rowKey="id" 
                    size="small"
                    pagination={{ pageSize: 5 }}
                    scroll={{ x: 'max-content' }}
                />
            </Modal>

            {/* Detail Modal */}
            <Modal 
                title="文件详情" 
                open={detailModalOpen} 
                onCancel={() => setDetailModalOpen(false)}
                footer={null}
            >
                {currentDetail && (
                    <div className="space-y-2">
                        <p><strong>文件名称:</strong> {currentDetail.fileName}</p>
                        <p><strong>类型:</strong> {DOC_TYPE_LABELS[currentDetail.type] || currentDetail.type}</p>
                        {currentDetail.manufacturerRole && (
                            <p>
                                <strong>厂家角色:</strong>{' '}
                                <Space size={[0, 4]} wrap>
                                    {currentDetail.manufacturerRole.split(',').map((role: string) => (
                                        <Tag key={role} color="blue">{role}</Tag>
                                    ))}
                                </Space>
                            </p>
                        )}
                        <p><strong>元数据:</strong></p>
                        <pre className="bg-gray-100 p-2 text-xs">{JSON.stringify(currentDetail.parsedObj, null, 2)}</pre>
                    </div>
                )}
            </Modal>
        </div>
    );
}
