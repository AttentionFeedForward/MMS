
'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Upload, Modal, message, Card, Tooltip } from 'antd';
import { SearchOutlined, UploadOutlined, DownloadOutlined, StarOutlined, RiseOutlined, FallOutlined, MinusOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ManufacturerRating {
    id: string;
    name: string;
    scores: Record<number, number>;
    average: string | null;
    latestYear: number | null;
}

export default function RatingsPage() {
    const [data, setData] = useState<ManufacturerRating[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const router = useRouter();

    const fetchRatings = async (search = '') => {
        setLoading(true);
        try {
            const res = await fetch(`/api/ratings?search=${encodeURIComponent(search)}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            } else {
                message.error('Failed to load ratings');
            }
        } catch (error) {
            console.error(error);
            message.error('Error loading data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRatings();
    }, []);

    const handleSearch = () => {
        fetchRatings(searchText);
    };

    const handleDownloadTemplate = () => {
        const template = [
            { '厂家名称': '示例厂家A', '年份': 2023, '评分': 95 },
            { '厂家名称': '示例厂家B', '年份': 2024, '评分': 88 }
        ];
        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "供应商评分导入模板.xlsx");
    };

    const handleUpload = async (file: File) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/ratings/import', {
                method: 'POST',
                body: formData,
            });
            const result = await res.json();

            if (res.ok) {
                message.success(`导入完成: 成功 ${result.details.success} 条, 失败 ${result.details.failed} 条`);
                if (result.details.failed > 0) {
                    Modal.warning({
                        title: '部分导入失败',
                        content: (
                            <div className="max-h-60 overflow-auto">
                                <p>以下条目导入失败（可能是厂家不存在）：</p>
                                <ul className="list-disc pl-5">
                                    {result.details.errors.map((err: string, i: number) => (
                                        <li key={i} className="text-red-500 text-xs">{err}</li>
                                    ))}
                                </ul>
                            </div>
                        ),
                        width: 600
                    });
                }
                setIsModalOpen(false);
                fetchRatings(searchText);
            } else {
                message.error(result.error || 'Upload failed');
            }
        } catch (error) {
            console.error(error);
            message.error('Upload error');
        } finally {
            setUploading(false);
        }
        return false; // Prevent default antd upload behavior
    };

    // Calculate dynamic years to show based on current year
    const currentYear = new Date().getFullYear();
    const yearsToShow = [currentYear, currentYear - 1, currentYear - 2];

    const columns = [
        {
            title: '厂家名称',
            dataIndex: 'name',
            key: 'name',
            sorter: (a: ManufacturerRating, b: ManufacturerRating) => a.name.localeCompare(b.name),
            render: (text: string) => <span className="font-medium text-blue-700">{text}</span>
        },
        ...yearsToShow.map(year => ({
            title: `${year}年评分`,
            dataIndex: ['scores', year],
            key: `score_${year}`,
            render: (score: number) => score ? (
                <span className={score < 60 ? 'text-red-500 font-bold' : score >= 90 ? 'text-green-600 font-bold' : ''}>
                    {score}
                </span>
            ) : <span className="text-gray-300">-</span>,
            sorter: (a: ManufacturerRating, b: ManufacturerRating) => (a.scores[year] || 0) - (b.scores[year] || 0)
        })),
        {
            title: '平均分',
            dataIndex: 'average',
            key: 'average',
            sorter: (a: ManufacturerRating, b: ManufacturerRating) => parseFloat(a.average || '0') - parseFloat(b.average || '0'),
            render: (avg: string) => avg ? <strong>{avg}</strong> : '-'
        },
        {
            title: '趋势',
            key: 'trend',
            render: (_: any, record: ManufacturerRating) => {
                // Simple trend logic: compare latest available year with previous
                const scores = record.scores;
                const years = Object.keys(scores).map(Number).sort((a, b) => b - a); // Descending
                if (years.length < 2) return <MinusOutlined className="text-gray-400" />;
                
                const latest = scores[years[0]];
                const prev = scores[years[1]];
                
                if (latest > prev) return <Tooltip title="评分上升"><RiseOutlined className="text-green-500" /></Tooltip>;
                if (latest < prev) return <Tooltip title="评分下降"><FallOutlined className="text-red-500" /></Tooltip>;
                return <Tooltip title="评分持平"><MinusOutlined className="text-gray-400" /></Tooltip>;
            }
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                         <Link href="/" className="text-gray-500 hover:text-blue-600 mb-2 inline-block">&larr; 返回主页</Link>
                         <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                            <StarOutlined className="text-yellow-500" /> 供应商年度评分
                         </h1>
                    </div>
                    <Button 
                        type="primary" 
                        icon={<UploadOutlined />} 
                        onClick={() => setIsModalOpen(true)}
                        size="large"
                    >
                        导入评分数据
                    </Button>
                </div>

                <Card>
                    <div className="flex gap-4 mb-6">
                        <Input 
                            placeholder="搜索厂家名称..." 
                            prefix={<SearchOutlined />} 
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            onPressEnter={handleSearch}
                            className="max-w-md"
                        />
                        <Button onClick={handleSearch}>搜索</Button>
                    </div>

                    <Table 
                        columns={columns} 
                        dataSource={data} 
                        rowKey="id" 
                        loading={loading}
                        pagination={{ pageSize: 20 }}
                    />
                </Card>

                <Modal
                    title="导入供应商评分"
                    open={isModalOpen}
                    onCancel={() => setIsModalOpen(false)}
                    footer={null}
                >
                    <div className="space-y-6 py-4">
                        <div className="bg-blue-50 p-4 rounded-md text-blue-800 text-sm">
                            <p className="font-bold mb-2">说明：</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>请使用标准模板进行数据导入。</li>
                                <li><strong>厂家名称</strong>必须与系统中已有厂家完全一致，否则将导入失败。</li>
                                <li>若某厂家某年份已存在评分，导入将覆盖旧数据。</li>
                            </ul>
                        </div>

                        <div className="flex justify-center">
                             <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                                下载Excel模板
                            </Button>
                        </div>

                        <div className="border-t pt-4">
                            <p className="mb-2 font-medium">上传文件：</p>
                            <Upload.Dragger 
                                accept=".xlsx, .xls"
                                beforeUpload={handleUpload}
                                showUploadList={false}
                                disabled={uploading}
                            >
                                <p className="ant-upload-drag-icon">
                                    <UploadOutlined />
                                </p>
                                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                                {uploading && <p className="text-blue-500 mt-2">正在导入中，请稍候...</p>}
                            </Upload.Dragger>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
}
