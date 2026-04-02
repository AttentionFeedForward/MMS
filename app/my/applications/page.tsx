'use client';

import React, { useEffect, useState } from 'react';
import { Table, Button, Tabs, message, Tag, Space, Card, Modal, Descriptions, Tooltip } from 'antd';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { FileTextOutlined, FolderOutlined, InfoCircleOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;

const DOC_TYPE_LABELS: Record<string, string> = {
    'LICENSE': '营业执照',
    'ISO_QUALITY': '质量管理体系认证证书',
    'ISO_SAFETY': '安全管理体系认证证书',
    'ISO_ENV': '环境管理体系认证证书',
    'CERTIFICATE': '产品合格证',
    'TYPE_REPORT': '产品型式检验报告'
};

const MANUFACTURER_TYPES = ['LICENSE', 'ISO_QUALITY', 'ISO_SAFETY', 'ISO_ENV'];
const PRODUCT_TYPES = ['CERTIFICATE', 'TYPE_REPORT'];

export default function MyApplications() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('materials');
  const [data, setData] = useState<{ materials: any[], projects: any[] }>({ materials: [], projects: [] });
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const fetchData = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/my/applications');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        message.error(json.message);
      }
    } catch (error) {
      message.error('获取申请记录失败');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  if (loading || !user) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">我的申请管理</h1>
          <Button onClick={() => router.push('/')}>返回首页</Button>
        </div>

        <Card>
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="资料录入申请" key="materials">
              <MyMaterialApplications data={data.materials} loading={fetching} />
            </TabPane>
            <TabPane tab="项目权限申请" key="projects">
              <MyProjectApplications data={data.projects} loading={fetching} />
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function MyMaterialApplications({ data, loading }: { data: any[], loading: boolean }) {
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [currentDetail, setCurrentDetail] = useState<any>(null);

    const handleView = (filePath: string) => {
        window.open(filePath, '_blank');
    };

    const handleDownload = (filePath: string, fileName: string) => {
        const link = document.createElement('a');
        link.href = filePath;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const showDetails = (record: any) => {
        let parsed = {};
        try { parsed = JSON.parse(record.parsedMeta || '{}'); } catch (e) {}
        setCurrentDetail({ ...record, parsedObj: parsed });
        setDetailModalOpen(true);
    };

    const columns = [
        {
            title: '文件名称',
            dataIndex: 'fileName',
            key: 'fileName',
            ellipsis: true,
            render: (text: string) => <Tooltip title={text}>{text}</Tooltip>
        },
        {
            title: '厂家',
            render: (_: any, r: any) => r.manufacturer?.name || '-',
            ellipsis: true,
        },
        {
            title: '物料',
            render: (_: any, r: any) => r.masterMaterial?.name || '-',
            ellipsis: true,
        },
        {
            title: '提交时间',
            dataIndex: 'createdAt',
            render: (t: string) => new Date(t).toLocaleDateString(),
            width: 120,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status: string) => {
                let color = 'default';
                let text = status;
                if (status === 'APPROVED') { color = 'green'; text = '已通过'; }
                if (status === 'PENDING') { color = 'orange'; text = '审核中'; }
                if (status === 'REJECTED') { color = 'red'; text = '已驳回'; }
                return <Tag color={color}>{text}</Tag>;
            }
        },
        {
            title: '驳回原因',
            dataIndex: 'rejectReason',
            key: 'rejectReason',
            ellipsis: true,
            render: (text: string) => text ? <Tooltip title={text}><span className="text-red-500">{text}</span></Tooltip> : '-'
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_: any, record: any) => (
                <Space size="small">
                    <Button 
                        type="text" 
                        icon={<EyeOutlined />} 
                        onClick={() => handleView(record.filePath)}
                        title="查看"
                    />
                    <Button 
                        type="text" 
                        icon={<DownloadOutlined />} 
                        onClick={() => handleDownload(record.filePath, record.fileName)} 
                        title="下载"
                    />
                    <Button 
                        type="text" 
                        icon={<InfoCircleOutlined />} 
                        onClick={() => showDetails(record)}
                        title="详情"
                    />
                </Space>
            )
        }
    ];

    return (
        <>
            <Table columns={columns} dataSource={data} rowKey="id" loading={loading} />
            
            <Modal
                title="申请详情"
                open={detailModalOpen}
                onCancel={() => setDetailModalOpen(false)}
                footer={null}
                width={700}
            >
                {currentDetail && (
                    <Descriptions bordered column={1} size="small">
                        <Descriptions.Item label="文件名称">{currentDetail.fileName}</Descriptions.Item>
                        <Descriptions.Item label="文件类型">{DOC_TYPE_LABELS[currentDetail.type] || currentDetail.type}</Descriptions.Item>
                        
                        <Descriptions.Item label="申请人">{currentDetail.uploader?.username || '-'}</Descriptions.Item>
                        <Descriptions.Item label="提交时间">{new Date(currentDetail.createdAt).toLocaleString()}</Descriptions.Item>
                        <Descriptions.Item label="状态">
                            {currentDetail.status === 'APPROVED' && <Tag color="green">已通过</Tag>}
                            {currentDetail.status === 'PENDING' && <Tag color="orange">审核中</Tag>}
                            {currentDetail.status === 'REJECTED' && <Tag color="red">已驳回</Tag>}
                        </Descriptions.Item>
                        <Descriptions.Item label="国别">{currentDetail.manufacturer?.country || '-'}</Descriptions.Item>

                        <Descriptions.Item label="厂家">{currentDetail.manufacturer?.name || '-'}</Descriptions.Item>
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

                        {currentDetail.rejectReason && (
                             <Descriptions.Item label="驳回原因">
                                 <span className="text-red-500">{currentDetail.rejectReason}</span>
                             </Descriptions.Item>
                        )}
                        
                        <Descriptions.Item label="解析元数据">
                            <pre className="text-xs bg-gray-50 p-2 rounded max-h-40 overflow-auto">
                                {JSON.stringify(currentDetail.parsedObj, null, 2)}
                            </pre>
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>
        </>
    );
}

function MyProjectApplications({ data, loading }: { data: any[], loading: boolean }) {
    const columns = [
        {
            title: '项目名称',
            render: (_: any, r: any) => r.project?.name || '-',
        },
        {
            title: '项目编号',
            render: (_: any, r: any) => r.project?.code || '-',
        },
        {
            title: '申请时间',
            dataIndex: 'createdAt',
            render: (t: string) => new Date(t).toLocaleDateString(),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                let color = 'default';
                let text = status;
                if (status === 'APPROVED') { color = 'green'; text = '已通过'; }
                if (status === 'PENDING') { color = 'orange'; text = '审核中'; }
                if (status === 'REJECTED') { color = 'red'; text = '已驳回'; }
                return <Tag color={color}>{text}</Tag>;
            }
        },
        {
            title: '驳回原因',
            dataIndex: 'rejectReason',
            key: 'rejectReason',
            render: (text: string) => text ? <span className="text-red-500">{text}</span> : '-'
        }
    ];

    return <Table columns={columns} dataSource={data} rowKey="id" loading={loading} />;
}
