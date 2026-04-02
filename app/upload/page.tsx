'use client';

import React, { useState, useEffect } from 'react';
import { Upload, Button, Input, Card, message, Row, Col, Typography, Modal, Select, Spin, Alert, Progress, Checkbox } from 'antd';
import Link from 'next/link';
import { UploadOutlined, EyeOutlined, DeleteOutlined, RobotOutlined, CheckCircleOutlined, FilePdfOutlined, HomeOutlined, ShopOutlined, FileTextOutlined } from '@ant-design/icons';
import Image from 'next/image';
import MaterialCodeSelect, { type MaterialCodeItem } from '../components/MaterialCodeSelect';

const COUNTRIES = [
  "中国", "美国", "英国", "德国", "法国", "日本", "韩国", "俄罗斯", "加拿大", "澳大利亚", 
  "意大利", "西班牙", "印度", "巴西", "南非", "墨西哥", "印尼", "土耳其", "沙特阿拉伯", 
  "阿根廷", "波兰", "荷兰", "比利时", "瑞典", "瑞士", "泰国", "马来西亚", "越南", 
  "菲律宾", "新加坡", "新西兰", "爱尔兰", "奥地利", "挪威", "丹麦", "芬兰", "葡萄牙", 
  "希腊", "捷克", "匈牙利", "罗马尼亚", "乌克兰", "哈萨克斯坦", "埃及", "尼日利亚", 
  "肯尼亚", "埃塞俄比亚", "阿尔及利亚", "摩洛哥", "阿联酋", "以色列", "巴基斯坦", 
  "孟加拉国", "智利", "哥伦比亚", "秘鲁", "委内瑞拉", "其他"
];

const { Title, Text } = Typography;
const { Option } = Select;

// Document Types Definitions
const MANUFACTURER_DOCS = [
  { key: 'LICENSE', label: '营业执照' },
  { key: 'ISO_QUALITY', label: '质量管理体系认证证书' },
  { key: 'ISO_SAFETY', label: '安全管理体系认证证书' },
  { key: 'ISO_ENV', label: '环境管理体系认证证书' },
  { key: 'COMPANY_ACHIEVEMENT', label: '公司业绩' },
  { key: 'OTHER', label: '其他' },
];

const PRODUCT_DOCS = [
  { key: 'CERTIFICATE', label: '产品合格证' },
  { key: 'TYPE_REPORT', label: '产品型式检验报告' },
];

type CategoryType = 'MANUFACTURER' | 'PRODUCT';

export default function UploadPage() {
  const [category, setCategory] = useState<CategoryType | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<{ key: string, label: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any>({});
  const [country, setCountry] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState<"active" | "success" | "exception">("active");
  const [progressMessage, setProgressMessage] = useState("");
  const [manufacturerRole, setManufacturerRole] = useState<string[]>([]);

  // 1. Handle Category Selection
  const handleCategorySelect = (cat: CategoryType) => {
    setCategory(cat);
    // Reset role when category changes to MANUFACTURER, or just reset it generally
    if (cat !== 'MANUFACTURER') {
        setManufacturerRole([]);
    }
  };
  
  // 1.5 Handle Role Selection
  const handleRoleChange = (checkedValues: any) => {
    setManufacturerRole(checkedValues);
  };

  // 2. Open Modal
  const openUploadModal = (docType: { key: string, label: string }) => {
    setSelectedDocType(docType);
    setUploadFile(null);
    setPreviewUrl(null);
    setParsedData({});
    setCountry([]);
    setIsModalOpen(true);
  };

  // 3. Handle File Selection
  const handleFileSelect = (file: File) => {
    const isPdfOrImgOrWord = file.type === 'application/pdf' || file.type.startsWith('image/') || 
                             file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                             file.type === 'application/msword';

    if (!isPdfOrImgOrWord) {
        message.error('只支持 PDF、图片或 Word 文件!');
        return Upload.LIST_IGNORE;
    }

    setUploadFile(file);
    setPreviewUrl(null);
    setPreviewHtml(null);
    
    // Create preview
    if (file.type.startsWith('image/') || file.type === 'application/pdf' || 
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        file.type === 'application/msword') {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
    }

    return false; // Prevent auto upload
  };

  // 4. Parse File (OCR + LLM)
  const handleParse = async () => {
    if (!uploadFile) return;
    setIsParsing(true);
    try {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('docType', selectedDocType?.key || '');

        // Send to Next.js API which proxies to Python service
        const res = await fetch('/api/parse', {
            method: 'POST',
            body: formData
        });
        
        const json = await res.json();
        
        if (json.success) {
            // Map Chinese keys to English keys
            const rawData = json.data;
            const mappedData: any = {};
            
            // Mapping Logic
            if (rawData['生产厂家']) mappedData.manufacturerName = rawData['生产厂家'];
            if (rawData['委托单位']) mappedData.manufacturerName = rawData['委托单位']; // For Type Report
            
            if (rawData['产品名称/样品名称']) mappedData.materialName = rawData['产品名称/样品名称'];
            if (rawData['规格型号']) mappedData.model = rawData['规格型号'];
            
            if (rawData['证书有效期']) mappedData.expiryDate = rawData['证书有效期'];
            if (rawData['营业期限']) mappedData.expiryDate = rawData['营业期限'];
            if (rawData['报告日期/签发日期']) mappedData.reportDate = rawData['报告日期/签发日期'];

            setParsedData(mappedData);
            message.success("解析成功，请核对信息");
        } else {
            message.error("解析失败: " + (json.message || "未知错误"));
        }
    } catch (e) {
        console.error(e);
        message.error("解析出错");
    } finally {
        setIsParsing(false);
    }
  };

  // 5. Confirm & Upload
  const handleConfirm = async () => {
    if (!uploadFile || !selectedDocType) return;
    
    // Basic validation
    if (!parsedData.manufacturerName) {
        message.error("请填写厂家名称");
        return;
    }
    if (country.length === 0) {
        message.error("请选择适用国别");
        return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setProgressStatus("active");
    setProgressMessage("正在准备文件...");

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('type', selectedDocType.key);
    formData.append('manufacturerName', parsedData.manufacturerName);
    formData.append('country', country.join(',')); // Join array to string
    
    if (category === 'MANUFACTURER') {
        formData.append('manufacturerRole', manufacturerRole.join(','));
    }

    if (category === 'PRODUCT') {
        if (!parsedData.materialCode) {
             message.error("请选择物料编码");
             setIsUploading(false);
             return;
        }
        formData.append('materialCode', parsedData.materialCode);
        if (parsedData.materialName) formData.append('materialName', parsedData.materialName);
    }
    
    // Merge manual edits from parsedData inputs
    formData.append('parsedMeta', JSON.stringify(parsedData));

    try {
        // Simulate progress for file upload start
        setUploadProgress(10);
        setProgressMessage("正在上传文件到服务器...");

        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (res.ok) {
            // Start polling for index status if needed, or assume backend waits (which it does based on python service sync call)
            // But since Next.js API awaits Python API, we can increment progress while waiting?
            // Actually fetch awaits response.
            // Let's fake progress while waiting for the big response
        }

        const json = await res.json();
        
        if (json.success) {
            setUploadProgress(100);
            setProgressStatus("success");
            setProgressMessage("文件解析与向量化完成！");
            
            if (json.status === 'PENDING') {
                message.success("上传成功！资料需要管理员审核后才会显示。");
            } else {
                message.success("上传成功！");
            }
            setTimeout(() => {
                setIsModalOpen(false);
                setUploadProgress(0); // Reset for next time
            }, 1000);
        } else {
            setUploadProgress(100);
            setProgressStatus("exception");
            setProgressMessage("上传失败：" + json.message);
            message.error("上传失败：" + json.message);
        }
    } catch (e) {
        console.error(e);
        setUploadProgress(100);
        setProgressStatus("exception");
        setProgressMessage("系统错误");
        message.error("系统错误");
    } finally {
        setIsUploading(false);
    }
  };

  // Fake progress effect when uploading
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isUploading && uploadProgress < 90 && progressStatus === 'active') {
        timer = setInterval(() => {
            setUploadProgress(prev => {
                // Slower progress as it gets higher
                const increment = prev < 50 ? 5 : prev < 80 ? 2 : 1;
                const next = prev + increment;
                if (next > 90) return 90; // Cap at 90% until done
                
                // Update message based on progress stage
                if (next > 20 && next < 50) setProgressMessage("正在进行OCR文字识别...");
                if (next >= 50 && next < 80) setProgressMessage("正在生成文档切片...");
                if (next >= 80) setProgressMessage("正在写入向量数据库...");
                
                return next;
            });
        }, 800);
    }
    return () => clearInterval(timer);
  }, [isUploading, uploadProgress, progressStatus]);

  // 6. Handle Modal Close
  const handleModalCancel = () => {
    if (isUploading) return; // Prevent closing while uploading
    setIsModalOpen(false);
  };

  const renderParsedFields = () => {
    if (!selectedDocType) return null;
    const type = selectedDocType.key;
    
    const fields = [];

    // 1. Country Selection (Global for all types)
    fields.push(
        <div key="country" className="mb-2">
            <label className="block text-sm font-bold mb-1">适用国别</label>
            <Select
                mode="multiple"
                allowClear
                style={{ width: '100%' }}
                placeholder="请选择适用国别"
                value={country}
                onChange={setCountry}
                optionFilterProp="children"
            >
                {COUNTRIES.map(c => (
                    <Option key={c} value={c}>{c}</Option>
                ))}
            </Select>
        </div>
    );

    // 2. Manufacturer Name (For all types)
    // Note: For CERTIFICATE, user explicitly requested adding it. For others, it was already there.
    if (['LICENSE', 'ISO_QUALITY', 'ISO_SAFETY', 'ISO_ENV', 'TYPE_REPORT', 'CERTIFICATE', 'COMPANY_ACHIEVEMENT', 'OTHER'].includes(type)) {
        fields.push(
            <div key="manuf" className="mb-2">
                <label className="block text-sm font-bold mb-1">厂家名称</label>
                <Input 
                    value={parsedData.manufacturerName || ''} 
                    onChange={e => setParsedData({...parsedData, manufacturerName: e.target.value})}
                    placeholder="请输入厂家名称"
                />
            </div>
        );
    }

    if (['ISO_QUALITY', 'ISO_SAFETY', 'ISO_ENV', 'LICENSE'].includes(type)) {
        fields.push(
            <div key="expiry" className="mb-2">
                <label className="block text-sm font-bold mb-1">
                    {type === 'LICENSE' ? '营业期限' : '证书有效期'}
                </label>
                <Input 
                    placeholder="YYYY-MM-DD"
                    value={parsedData.expiryDate || ''} 
                    onChange={e => setParsedData({...parsedData, expiryDate: e.target.value})}
                />
            </div>
        );
    }

    if (['CERTIFICATE', 'TYPE_REPORT'].includes(type)) {
        fields.push(
            <div key="matName" className="mb-2">
                <label className="block text-sm font-bold mb-1">物料编码/名称</label>
                <MaterialCodeSelect
                    value={
                        parsedData.materialCode
                            ? ({
                                  code: parsedData.materialCode,
                                  name: parsedData.materialName || '',
                                  level: parsedData.materialLevel || 0,
                                  parentCode: parsedData.materialParentCode || null,
                              } as MaterialCodeItem)
                            : null
                    }
                    onChange={(item) => {
                        if (!item) {
                            setParsedData({
                                ...parsedData,
                                materialCode: '',
                                materialName: '',
                                materialLevel: null,
                                materialParentCode: null,
                            });
                            return;
                        }
                        setParsedData({
                            ...parsedData,
                            materialCode: item.code,
                            materialName: item.name,
                            materialLevel: item.level,
                            materialParentCode: item.parentCode,
                        });
                    }}
                />
            </div>
        );
        fields.push(
            <div key="model" className="mb-2">
                <label className="block text-sm font-bold mb-1">型号规格</label>
                <Input 
                    value={parsedData.model || ''} 
                    onChange={e => setParsedData({...parsedData, model: e.target.value})}
                    placeholder="请输入型号规格"
                />
            </div>
        );
    }

    if (type === 'TYPE_REPORT') {
        fields.push(
            <div key="reportDate" className="mb-2">
                <label className="block text-sm font-bold mb-1">报告日期</label>
                <Input 
                    placeholder="YYYY-MM-DD"
                    value={parsedData.reportDate || ''} 
                    onChange={e => setParsedData({...parsedData, reportDate: e.target.value})}
                />
            </div>
        );
    }

    return <div className="mt-4 border-t pt-4">{fields}</div>;
  };

  const renderPreview = () => {
    if (!uploadFile) return <div className="text-gray-500">文件已选择 (无预览)</div>;
    
    if (uploadFile.type.startsWith('image/') && previewUrl) {
        return <Image src={previewUrl} alt="Preview" width={500} height={384} className="max-w-full max-h-full object-contain" unoptimized />;
    }
    
    if (uploadFile.type === 'application/pdf') {
        return (
            <div className="flex flex-col items-center justify-center text-gray-500">
                <FilePdfOutlined style={{ fontSize: '48px', color: '#ff4d4f', marginBottom: '8px' }} />
                <div>PDF 文件 ({uploadFile.name})</div>
                <div className="text-xs mt-2">点击下方&quot;查看原文件&quot;预览内容</div>
            </div>
        );
    }
    
    if (uploadFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        uploadFile.type === 'application/msword') {
         return (
            <div className="flex flex-col items-center justify-center text-gray-500">
                <FileTextOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '8px' }} />
                <div>Word 文档 ({uploadFile.name})</div>
                <div className="text-xs mt-2">点击下方&quot;查看原文件&quot;预览内容</div>
            </div>
        );
    }

    return <div className="text-gray-500">不支持预览的文件类型</div>;
  };

  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const handleViewOriginal = async () => {
      if (!uploadFile) return;
      
      // 对于 PDF 和图片，直接打开 Blob URL
      if (uploadFile.type === 'application/pdf' || uploadFile.type.startsWith('image/')) {
          if (previewUrl) window.open(previewUrl, '_blank');
          return;
      }
      
      // 对于 Word 文档，调用后端转换为 PDF 并预览
      if (uploadFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
          uploadFile.type === 'application/msword') {
          
          setIsPreviewLoading(true);
          const hide = message.loading("正在转换 Word 文档以供预览...", 0);
          
          try {
              const formData = new FormData();
              formData.append('file', uploadFile);
              
              const res = await fetch('/api/preview', {
                  method: 'POST',
                  body: formData
              });
              
              if (!res.ok) {
                  throw new Error(`转换失败: ${res.statusText}`);
              }
              
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
              
          } catch (e: any) {
              console.error(e);
              message.error("预览生成失败: " + e.message);
          } finally {
              hide();
              setIsPreviewLoading(false);
          }
      }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <Title level={2} style={{ margin: 0 }}>资料录入 (Data Entry)</Title>
        <Link href="/">
            <Button icon={<HomeOutlined />}>返回首页</Button>
        </Link>
      </div>

      {/* Step 1: Category Selection */}
      <div className="mb-8 grid grid-cols-2 gap-8">
        <Card 
            hoverable 
            className={`text-center cursor-pointer border-2 ${category === 'MANUFACTURER' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
            onClick={() => handleCategorySelect('MANUFACTURER')}
        >
            <Title level={4}>厂家资质证书类</Title>
            <Text type="secondary">营业执照、ISO三体系证书</Text>
        </Card>
        <Card 
            hoverable 
            className={`text-center cursor-pointer border-2 ${category === 'PRODUCT' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
            onClick={() => handleCategorySelect('PRODUCT')}
        >
            <Title level={4}>产品类</Title>
            <Text type="secondary">产品合格证、型式检验报告</Text>
        </Card>
      </div>

        {/* Step 2: Role Selection (Only for MANUFACTURER) */}
        {category === 'MANUFACTURER' && (
          <div className="mb-8 animate-fade-in">
             <Title level={4} className="mb-4">
              <ShopOutlined className="mr-2" />
              请选择厂家角色 (Manufacturer Role)
            </Title>
            <Card>
                <Checkbox.Group 
                    options={[
                        { label: '供应商 (Supplier)', value: '供应商' },
                        { label: '生产厂家 (Manufacturer)', value: '生产厂家' },
                        { label: '组装厂 (Assembler)', value: '组装厂' },
                    ]} 
                    value={manufacturerRole} 
                    onChange={handleRoleChange} 
                />
            </Card>
          </div>
        )}

        {/* Step 3: Document Type Selection */}
        {(category === 'PRODUCT' || (category === 'MANUFACTURER' && manufacturerRole.length > 0)) && (
          <div className="animate-fade-in">
            <Title level={4} className="mb-4">
              <FileTextOutlined className="mr-2" />
              请选择要上传的资料类型 (Document Type)
            </Title>
            
            <Row gutter={[16, 16]}>
              {(category === 'MANUFACTURER' ? MANUFACTURER_DOCS : PRODUCT_DOCS).map((doc) => (
                <Col xs={24} sm={12} md={8} lg={6} key={doc.key}>
                  <Card 
                    hoverable 
                    className="text-center h-full flex flex-col justify-center items-center border-gray-200 hover:border-blue-500 transition-all"
                    onClick={() => openUploadModal(doc)}
                  >
                    <div className="text-4xl text-blue-500 mb-4">
                      {doc.key === 'TYPE_REPORT' ? <RobotOutlined /> : <FilePdfOutlined />}
                    </div>
                    <div className="font-medium text-gray-700">{doc.label}</div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}

      {/* Step 4: Upload Modal */}
      <Modal
        title={`上传 - ${selectedDocType?.label}`}
        open={isModalOpen}
        onCancel={handleModalCancel}
        footer={null}
        width={800}
        maskClosable={false}
      >
        <div className="flex gap-6">
            {/* Left: File Preview */}
            <div className="w-1/2 border-r pr-6">
                {!uploadFile ? (
                     <Upload.Dragger 
                        beforeUpload={handleFileSelect} 
                        showUploadList={false}
                        className="h-64"
                    >
                        <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                        <p className="ant-upload-text">点击或拖拽文件到此区域</p>
                    </Upload.Dragger>
                ) : (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 bg-gray-100 flex items-center justify-center rounded overflow-hidden relative border">
                             {renderPreview()}
                        </div>
                        <div className="mt-4 flex justify-between items-center">
                            <span className="truncate max-w-[200px]" title={uploadFile.name}>{uploadFile.name}</span>
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => { setUploadFile(null); setParsedData({}); }} disabled={isUploading}>移除</Button>
                        </div>
                        {previewUrl && (
                             <Button type="link" block onClick={handleViewOriginal} className="mt-2">查看原文件</Button>
                        )}
                        
                        {/* Progress Bar Area */}
                        {(isUploading || uploadProgress > 0) && (
                            <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-100">
                                <div className="mb-2 flex justify-between text-xs text-gray-500">
                                    <span>{progressMessage}</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <Progress percent={uploadProgress} status={progressStatus} showInfo={false} strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Right: Actions & Parse Data */}
            <div className="w-1/2">
                <div className="mb-4">
                    <Button 
                        type="default" 
                        block 
                        icon={<RobotOutlined />} 
                        onClick={handleParse}
                        loading={isParsing}
                        disabled={!uploadFile}
                        className="mb-2"
                    >
                        智能解析 (OCR + LLM)
                    </Button>
                    <Alert message="解析后请务必核对下方信息" type="info" showIcon className="mb-4" />
                </div>

                <div className="bg-gray-50 p-4 rounded border">
                    <h4 className="font-bold mb-2 border-b pb-2">解析结果 (可编辑)</h4>
                    {renderParsedFields()}
                </div>

                <div className="mt-6">
                    <Button 
                        type="primary" 
                        block 
                        size="large" 
                        icon={<CheckCircleOutlined />} 
                        onClick={handleConfirm}
                        loading={isUploading}
                        disabled={!uploadFile}
                    >
                        确认上传
                    </Button>
                </div>
            </div>
        </div>
      </Modal>
    </div>
  );
}