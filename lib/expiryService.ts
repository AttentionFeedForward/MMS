import prisma from './db';
import { sendEmail } from './email';
import dayjs from 'dayjs';

const DOC_TYPE_LABELS: Record<string, string> = {
    'LICENSE': '营业执照',
    'ISO_QUALITY': '质量管理体系认证证书',
    'ISO_SAFETY': '安全管理体系认证证书',
    'ISO_ENV': '环境管理体系认证证书',
    'CERTIFICATE': '产品合格证',
    'TYPE_REPORT': '产品型式检验报告'
};

const TARGET_TYPES = ['ISO_QUALITY', 'ISO_SAFETY', 'ISO_ENV', 'LICENSE'];
const NOTIFICATION_EMAIL = '2538366087@qq.com';

// Helper to parse date string (copied from frontend logic)
function parseExpiryDate(dateStr: string | null | undefined): dayjs.Dayjs | null {
    if (!dateStr) return null;
    if (dateStr.includes('长期')) return null; // Valid forever

    let d = dayjs(dateStr);
    
    if (!d.isValid()) {
        // Matches YYYY-MM-DD, YYYY/MM/DD, YYYY年MM月DD日
        const dateMatches = dateStr.match(/(\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}日?)/g);
        if (dateMatches && dateMatches.length > 0) {
            let lastDateStr = dateMatches[dateMatches.length - 1];
            lastDateStr = lastDateStr.replace(/年|月/g, '-').replace(/日/g, '');
            d = dayjs(lastDateStr);
        }
    }

    return d.isValid() ? d : null;
}

export async function checkAndNotifyExpiredDocuments() {
    console.log('Starting expiry check...');
    
    // 1. Fetch all documents of target types
    const docs = await prisma.masterDocument.findMany({
        where: {
            type: { in: TARGET_TYPES }
        },
        include: {
            manufacturer: true,
            masterMaterial: true
        }
    });

    console.log(`Found ${docs.length} documents to check.`);

    let sentCount = 0;
    const expiredDocs: Array<{
        id: string;
        fileName: string;
        manufacturerName: string;
        docTypeName: string;
        expiryDateStr: string;
    }> = [];

    for (const doc of docs) {
        // Anti-spam logic removed: checking all files every time regardless of previous notifications
        
        // Determine expiry date
        let expiryDateStrRaw = doc.expiryDate ? dayjs(doc.expiryDate).format('YYYY-MM-DD') : null;
        
        // Try parsing from parsedMeta if not available directly
        if (!expiryDateStrRaw && doc.parsedMeta) {
            try {
                const meta = JSON.parse(doc.parsedMeta);
                expiryDateStrRaw = meta.expiryDate;
            } catch (e) {
                // ignore
            }
        }

        const expiryDate = parseExpiryDate(expiryDateStrRaw);

        // Check if expired
        if (expiryDate && expiryDate.isBefore(dayjs(), 'day')) {
            console.log(`Document ${doc.id} (${doc.fileName}) is expired.`);
            
            expiredDocs.push({
                id: doc.id,
                fileName: doc.fileName,
                manufacturerName: doc.manufacturer?.name || '未知厂家',
                docTypeName: DOC_TYPE_LABELS[doc.type] || doc.type,
                expiryDateStr: expiryDate.format('YYYY-MM-DD')
            });
        }
    }

    if (expiredDocs.length > 0) {
        console.log(`Found ${expiredDocs.length} expired documents to notify.`);

        // Build summary email
        const subject = `【物料报审系统】证书过期提醒 - 共${expiredDocs.length}份文件需更新`;
        
        let htmlRows = '';
        let textList = '';

        expiredDocs.forEach((item, index) => {
            htmlRows += `
                <tr style="background-color: ${index % 2 === 0 ? '#f9f9f9' : '#ffffff'};">
                    <td style="padding: 10px; border: 1px solid #ddd;">${item.manufacturerName}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${item.docTypeName}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${item.fileName}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #d32f2f;">${item.expiryDateStr}</td>
                </tr>
            `;
            textList += `${index + 1}. ${item.manufacturerName} - ${item.docTypeName} (过期日: ${item.expiryDateStr})\n`;
        });

        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #d32f2f;">证书过期提醒</h2>
                <p>系统检测到以下 <strong>${expiredDocs.length}</strong> 份文件已过期，请及时登录物料报审系统进行更换：</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background-color: #eee;">
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">厂家名称</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">文件类型</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">文件名称</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">过期时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${htmlRows}
                    </tbody>
                </table>
                
                <hr style="margin-top: 30px;"/>
                <p style="font-size: 14px; color: #666;">
                    此邮件由物料报审系统自动发送，请勿直接回复。
                </p>
            </div>
        `;

        const text = `证书过期提醒\n\n系统检测到以下文件已过期：\n\n${textList}\n请及时登录系统进行更换。`;

        // Send batched email
        const success = await sendEmail({
            to: NOTIFICATION_EMAIL,
            subject,
            text,
            html
        });

        if (success) {
            sentCount = 1; // 1 email sent containing all items
            // Since we notify daily for all expired docs, we don't strictly need to update the timestamp anymore.
            // Removing the DB update loop to save resources.
            
            console.log('Batch notification email sent successfully.');
        } else {
            console.error('Failed to send batch notification email.');
        }
    } else {
        console.log('No new expired documents found.');
    }

    console.log(`Expiry check completed.`);
    return { checked: docs.length, expiredFound: expiredDocs.length, emailSent: sentCount > 0 };
}
