import React, { useState, useEffect } from 'react';
import { Upload, Button, Input, Modal, Select, message, Checkbox } from 'antd';
import { UploadOutlined, FilePdfOutlined, FileTextOutlined } from '@ant-design/icons';
import Image from 'next/image';
import MaterialCodeSelect, { type MaterialCodeItem } from './MaterialCodeSelect';

const { Option } = Select;

const MANUFACTURER_ROLES = ["生产厂家", "供应商", "组装厂"];

const COUNTRIES = [
  "中国", "美国", "英国", "德国", "法国", "日本", "韩国", "俄罗斯", "加拿大", "澳大利亚", 
  "意大利", "西班牙", "印度", "巴西", "南非", "墨西哥", "印尼", "土耳其", "沙特阿拉伯", 
  "阿根廷", "波兰", "荷兰", "比利时", "瑞典", "瑞士", "泰国", "马来西亚", "越南", 
  "菲律宾", "新加坡", "新西兰", "爱尔兰", "奥地利", "挪威", "丹麦", "芬兰", "葡萄牙", 
  "希腊", "捷克", "匈牙利", "罗马尼亚", "乌克兰", "哈萨克斯坦", "埃及", "尼日利亚", 
  "肯尼亚", "埃塞俄比亚", "阿尔及利亚", "摩洛哥", "阿联酋", "以色列", "巴基斯坦", 
  "孟加拉国", "智利", "哥伦比亚", "秘鲁", "委内瑞拉", "其他"
];

interface UploadModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    initialDocType: { key: string, label: string } | null;
    isReplace?: boolean;
    replaceTargetId?: string;
    initialManufacturerRole?: string[];
}

export default function UploadModal({ 
    visible, 
    onCancel, 
    onSuccess, 
    initialDocType, 
    isReplace = false,
    replaceTargetId,
    initialManufacturerRole
}: UploadModalProps) {
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<any>({});
    const [country, setCountry] = useState<string[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState("");
    const [manufacturerRole, setManufacturerRole] = useState<string[]>([]);
    const [category, setCategory] = useState<'MANUFACTURER' | 'PRODUCT' | null>(null);

    // Initialize state when visible or props change
    useEffect(() => {
        if (visible) {
            // Reset state
            setUploadFile(null);
            setPreviewUrl(null);
            setParsedData({});
            setCountry([]);
            setUploadProgress(0);
            setIsParsing(false);
            setIsUploading(false);
            
            if (initialDocType) {
                if (['LICENSE', 'ISO_QUALITY', 'ISO_SAFETY', 'ISO_ENV', 'COMPANY_ACHIEVEMENT', 'OTHER'].includes(initialDocType.key)) {
                    setCategory('MANUFACTURER');
                } else {
                    setCategory('PRODUCT');
                }
            }
            
            if (initialManufacturerRole) {
                setManufacturerRole(initialManufacturerRole);
            }
        }
    }, [visible, initialDocType, initialManufacturerRole]);

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
        
        // Create preview
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }

        return false; // Prevent auto upload
    };

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
            }
        }
    };

    const handleParse = async () => {
        if (!uploadFile || !initialDocType) return;
        setIsParsing(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('docType', initialDocType.key);

            const res = await fetch('/api/parse', {
                method: 'POST',
                body: formData
            });
            
            const json = await res.json();
            
            if (json.success) {
                const rawData = json.data;
                const mappedData: any = {};
                
                if (rawData['生产厂家']) mappedData.manufacturerName = rawData['生产厂家'];
                if (rawData['委托单位']) mappedData.manufacturerName = rawData['委托单位'];
                
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

    const handleConfirm = async () => {
        if (!uploadFile || !initialDocType) return;
        
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
        setProgressMessage("正在准备文件...");

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('type', initialDocType.key);
        formData.append('manufacturerName', parsedData.manufacturerName);
        formData.append('country', country.join(','));
        
        if (category === 'MANUFACTURER' && manufacturerRole.length > 0) {
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
        
        formData.append('parsedMeta', JSON.stringify(parsedData));

        // Add skipDuplicateCheck flag if replacing
        if (isReplace) {
            formData.append('skipDuplicateCheck', 'true');
            if (replaceTargetId) {
                formData.append('replaceTargetId', replaceTargetId);
            }
        }

        try {
            setProgressMessage("正在上传文件到服务器...");
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            const json = await res.json();
            
            if (json.success) {
                setUploadProgress(100);
                setProgressMessage("上传完成！");
                
                if (isReplace) {
                     message.success("替换成功");
                } else {
                    if (json.status === 'PENDING') {
                        message.success("上传成功！资料需要管理员审核后才会显示。");
                    } else {
                        message.success("上传成功！");
                    }
                }
                
                setTimeout(() => {
                    onSuccess();
                }, 1000);
            } else {
                message.error("上传失败：" + json.message);
            }
        } catch (e) {
            console.error(e);
            message.error("系统错误");
        } finally {
            setIsUploading(false);
        }
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

    const renderParsedFields = () => {
        if (!initialDocType) return null;
        const type = initialDocType.key;
        
        const fields = [];

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

        // Add Manufacturer Role Selection
        if (category === 'MANUFACTURER') {
            fields.push(
                <div key="role" className="mb-2">
                    <label className="block text-sm font-bold mb-1">厂家角色</label>
                    <Select
                        mode="multiple"
                        allowClear
                        style={{ width: '100%' }}
                        placeholder="请选择厂家角色（可多选）"
                        value={manufacturerRole}
                        onChange={setManufacturerRole}
                    >
                        {MANUFACTURER_ROLES.map(role => (
                            <Option key={role} value={role}>{role}</Option>
                        ))}
                    </Select>
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

    return (
        <Modal
            title={`${isReplace ? '替换' : '上传'} - ${initialDocType?.label}`}
            open={visible}
            onCancel={onCancel}
            maskClosable={false}
            footer={[
                <Button key="cancel" onClick={onCancel} disabled={isUploading}>取消</Button>,
                <Button key="submit" type="primary" onClick={handleConfirm} loading={isUploading}>
                    {isReplace ? '确认替换' : '确认上传'}
                </Button>
            ]}
            width={800}
        >
            <div className="grid grid-cols-2 gap-4">
                <div className="border-r pr-4">
                    <div className="mb-4">
                        <Upload 
                            beforeUpload={handleFileSelect} 
                            showUploadList={false}
                            accept=".pdf,image/*,.doc,.docx"
                        >
                            <Button icon={<UploadOutlined />}>选择文件</Button>
                        </Upload>
                        {uploadFile && <span className="ml-2 text-gray-500">{uploadFile.name}</span>}
                    </div>
                    
                    <div className="h-96 bg-gray-100 rounded flex items-center justify-center overflow-hidden border">
                        {renderPreview()}
                    </div>
                    {uploadFile && (
                        <div className="mt-2 text-center">
                            <Button size="small" onClick={handleViewOriginal} type="link">查看原文件</Button>
                        </div>
                    )}
                </div>
                
                <div className="pl-4">
                     <Button 
                        type="primary" 
                        onClick={handleParse} 
                        loading={isParsing}
                        disabled={!uploadFile}
                        block
                        className="mb-4"
                    >
                        智能解析 (OCR)
                    </Button>
                    
                    {category === 'MANUFACTURER' && (
                        <div className="mb-4">
                             <label className="block text-sm font-bold mb-1">厂家角色</label>
                             <Checkbox.Group 
                                options={[
                                    { label: '供应商', value: '供应商' },
                                    { label: '生产厂家', value: '生产厂家' },
                                    { label: '组装厂', value: '组装厂' },
                                ]} 
                                value={manufacturerRole} 
                                onChange={(vals) => setManufacturerRole(vals as string[])} 
                            />
                        </div>
                    )}

                    {renderParsedFields()}
                    
                    {isUploading && (
                        <div className="mt-4">
                            <div className="text-sm text-blue-500 mb-1">{progressMessage}</div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
