'use client';

import React, { useEffect, useState } from 'react';
import { Table, Button, Tabs, message, Tag, Space, Card, Modal, Input, Descriptions, Tooltip, Popconfirm } from 'antd';
import { CheckOutlined, CloseOutlined, ExclamationCircleOutlined, DownloadOutlined, EyeOutlined, InfoCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const { TabPane } = Tabs;
const { confirm } = Modal;
const { TextArea } = Input;

// Constants consistent with Search Page
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

export default function AdminApprovals() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('materials');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'ADMIN')) {
      message.error('无权访问');
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'ADMIN') {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">审批管理看板</h1>
          <Button onClick={() => router.push('/')}>返回首页</Button>
        </div>

        <Card>
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="资料录入申请" key="materials">
              <MaterialsList />
            </TabPane>
            <TabPane tab="项目权限申请" key="projects">
              <PendingProjectsList />
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function MaterialsList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [currentRejectId, setCurrentRejectId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/approvals/documents');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        message.error(json.message);
      }
    } catch (error) {
      message.error('获取资料列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = (id: string) => {
    confirm({
      title: '确认通过审核？',
      icon: <ExclamationCircleOutlined />,
      onOk: async () => {
        try {
          const res = await fetch(`/api/admin/approvals/documents/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'APPROVE' }),
          });
          const json = await res.json();
          if (json.success) {
            message.success('已通过审核');
            fetchData();
          } else {
            message.error(json.message);
          }
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  const openRejectModal = (id: string) => {
    setCurrentRejectId(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      message.error('请填写驳回原因');
      return;
    }
    if (!currentRejectId) return;

    try {
      const res = await fetch(`/api/admin/approvals/documents/${currentRejectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', reason: rejectReason }),
      });
      const json = await res.json();
      if (json.success) {
        message.success('已驳回');
        setRejectModalOpen(false);
        fetchData();
      } else {
        message.error(json.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
      try {
          const res = await fetch(`/api/admin/approvals/documents/${id}`, {
              method: 'DELETE'
          });
          const json = await res.json();
          if (json.success) {
              message.success('删除成功');
              fetchData();
          } else {
              message.error(json.message || '删除失败');
          }
      } catch (error) {
          message.error('系统错误');
      }
  };

  const showDetails = (record: any) => {
      let parsed = {};
      try { parsed = JSON.parse(record.parsedMeta || '{}'); } catch (e) {}
      setCurrentDetail({ ...record, parsedObj: parsed });
      setDetailModalOpen(true);
  };

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

  const columns = [
    {
      title: '文件名称',
      dataIndex: 'fileName',
      key: 'fileName',
      width: 200,
      ellipsis: true,
      render: (text: string) => (
          <Tooltip title={text}>
              {text}
          </Tooltip>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (t: string) => <Tag>{DOC_TYPE_LABELS[t] || t}</Tag> 
    },
    {
      title: '厂家名称',
      key: 'manufacturer',
      width: 150,
      ellipsis: true,
      render: (_: any, record: any) => (
          <Tooltip title={record.manufacturer?.name}>
              {record.manufacturer?.name || '-'}
          </Tooltip>
      )
    },
    {
      title: '物料名称',
      key: 'material',
      width: 100,
      ellipsis: true,
      render: (_: any, record: any) => (
          <Tooltip title={record.masterMaterial?.name}>
              {record.masterMaterial?.name || '-'}
          </Tooltip>
      )
    },
    {
        title: '申请人',
        key: 'uploader',
        width: 100,
        render: (_: any, r: any) => r.uploader?.username || 'Unknown'
    },
    {
        title: '提交时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 110,
        render: (t: string) => new Date(t).toLocaleDateString()
    },
    {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 90,
        render: (status: string) => {
            if (status === 'APPROVED') return <Tag color="green">已通过</Tag>;
            if (status === 'REJECTED') return <Tag color="red">已驳回</Tag>;
            return <Tag color="orange">待审核</Tag>;
        }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: any) => (
        <Space size="small">
          {record.status === 'PENDING' && (
            <>
              <Button 
                type="link" 
                size="small" 
                icon={<CheckOutlined />} 
                onClick={() => handleApprove(record.id)}
                title="通过"
              />
              <Button 
                type="link" 
                size="small" 
                danger 
                icon={<CloseOutlined />} 
                onClick={() => openRejectModal(record.id)}
                title="驳回"
              />
            </>
          )}
          <Button 
              type="text" 
              size="small"
              icon={<EyeOutlined />} 
              onClick={() => handleView(record.filePath)}
              title="查看"
          />
          <Button 
              type="text" 
              size="small"
              icon={<DownloadOutlined />} 
              onClick={() => handleDownload(record.filePath, record.fileName)} 
              title="下载"
          />
          <Button 
              type="text" 
              size="small"
              icon={<InfoCircleOutlined />} 
              onClick={() => showDetails(record)}
              title="详情"
          />
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button 
                type="text" 
                size="small"
                danger
                icon={<DeleteOutlined />} 
                title="删除"
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <>
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="驳回原因"
        open={rejectModalOpen}
        onOk={handleReject}
        onCancel={() => setRejectModalOpen(false)}
      >
        <TextArea 
          rows={4} 
          value={rejectReason} 
          onChange={e => setRejectReason(e.target.value)} 
          placeholder="请输入驳回原因..."
        />
      </Modal>

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

// Placeholder for Projects List (not requested to be updated, but kept for compilation)
function PendingProjectsList() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [currentRejectId, setCurrentRejectId] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/approvals/projects');
            const json = await res.json();
            if (json.success) {
                setData(json.data);
            } else {
                message.error(json.message);
            }
        } catch (error) {
            message.error('获取项目申请列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAction = async (id: string, action: 'APPROVE' | 'REVOKE') => {
        confirm({
            title: action === 'APPROVE' ? '确认通过权限申请？' : '确认关闭该用户权限？',
            icon: <ExclamationCircleOutlined />,
            content: action === 'REVOKE' ? '关闭后该用户将无法访问此项目档案' : '',
            onOk: async () => {
                try {
                    const res = await fetch(`/api/admin/approvals/projects/${id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action }),
                    });
                    const json = await res.json();
                    if (json.success) {
                        message.success(action === 'APPROVE' ? '已授权' : '已关闭权限');
                        fetchData();
                    } else {
                        message.error(json.message);
                    }
                } catch (error) {
                    message.error('操作失败');
                }
            },
        });
    };

    const openRejectModal = (id: string) => {
        setCurrentRejectId(id);
        setRejectReason('');
        setRejectModalOpen(true);
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            message.error('请填写驳回原因');
            return;
        }
        if (!currentRejectId) return;

        try {
            const res = await fetch(`/api/admin/approvals/projects/${currentRejectId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'REJECT', reason: rejectReason }),
            });
            const json = await res.json();
            if (json.success) {
                message.success('已驳回');
                setRejectModalOpen(false);
                fetchData();
            } else {
                message.error(json.message);
            }
        } catch (error) {
            message.error('操作失败');
        }
    };

    const columns = [
        {
            title: '申请人',
            dataIndex: ['user', 'username'],
            key: 'username',
        },
        {
            title: '项目名称',
            dataIndex: ['project', 'name'],
            key: 'projectName',
        },
        {
            title: '项目编码',
            dataIndex: ['project', 'code'],
            key: 'projectCode',
        },
        {
            title: '申请时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (t: string) => new Date(t).toLocaleString(),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                if (status === 'APPROVED') return <Tag color="green">已授权</Tag>;
                if (status === 'REJECTED') return <Tag color="red">已驳回</Tag>;
                return <Tag color="orange">待审核</Tag>;
            }
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    {record.status === 'PENDING' && (
                        <>
                            <Button 
                                type="link" 
                                size="small" 
                                icon={<CheckOutlined />} 
                                onClick={() => handleAction(record.id, 'APPROVE')}
                            >
                                通过
                            </Button>
                            <Button 
                                type="link" 
                                size="small" 
                                danger 
                                icon={<CloseOutlined />} 
                                onClick={() => openRejectModal(record.id)}
                            >
                                驳回
                            </Button>
                        </>
                    )}
                    {record.status === 'APPROVED' && (
                        <Button 
                            type="link" 
                            size="small" 
                            danger 
                            icon={<CloseOutlined />} 
                            onClick={() => handleAction(record.id, 'REVOKE')}
                        >
                            关闭权限
                        </Button>
                    )}
                </Space>
            )
        }
    ];

    return (
        <>
            <Table 
                columns={columns} 
                dataSource={data} 
                rowKey="id" 
                loading={loading}
            />
            <Modal
                title="驳回原因"
                open={rejectModalOpen}
                onOk={handleReject}
                onCancel={() => setRejectModalOpen(false)}
            >
                <TextArea 
                    rows={4} 
                    value={rejectReason} 
                    onChange={e => setRejectReason(e.target.value)} 
                    placeholder="请输入驳回原因..."
                />
            </Modal>
        </>
    );
}
