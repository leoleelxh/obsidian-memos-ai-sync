import { TFile, Vault } from 'obsidian';
import { MemoItem } from '../models/settings';
import { MemosService } from './memos-service';

export class FileService {
    constructor(
        private vault: Vault,
        private syncDirectory: string,
        private memosService: MemosService
    ) {}

    private formatDateTime(date: Date, format: 'filename' | 'display' = 'display'): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        if (format === 'filename') {
            return `${year}-${month}-${day} ${hours}-${minutes}`;
        }
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    private sanitizeFileName(fileName: string): string {
        return fileName
            .replace(/[\\/:*?"<>|#]/g, '_')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private getRelativePath(fromPath: string, toPath: string): string {
        const fromParts = fromPath.split('/');
        const toParts = toPath.split('/');
        fromParts.pop();

        let i = 0;
        while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
            i++;
        }

        const goBack = fromParts.length - i;
        const relativePath = [
            ...Array(goBack).fill('..'),
            ...toParts.slice(i)
        ].join('/');

        console.log(`Relative path from ${fromPath} to ${toPath}: ${relativePath}`);
        return relativePath;
    }

    private isImageFile(filename: string): boolean {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        const ext = filename.toLowerCase().split('.').pop();
        return ext ? imageExtensions.includes(`.${ext}`) : false;
    }

    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        if (!(await this.vault.adapter.exists(dirPath))) {
            await this.vault.adapter.mkdir(dirPath);
        }
    }

    async saveMemoToFile(memo: MemoItem): Promise<void> {
        const date = new Date(memo.createTime);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        
        const yearDir = `${this.syncDirectory}/${year}`;
        const monthDir = `${yearDir}/${month}`;
        
        await this.ensureDirectoryExists(yearDir);
        await this.ensureDirectoryExists(monthDir);
        
        const contentPreview = memo.content 
            ? this.sanitizeFileName(memo.content.slice(0, 50))
            : this.sanitizeFileName(memo.name.replace('memos/', ''));
        
        const timeStr = this.formatDateTime(date, 'filename');
        const fileName = this.sanitizeFileName(`${contentPreview} (${timeStr}).md`);
        const filePath = `${monthDir}/${fileName}`;
        
        let content = memo.content || '';
        content = content.replace(/\#([^\#\s]+)\#/g, '#$1');
        
        let documentContent = content;

        if (memo.resources && memo.resources.length > 0) {
            const images = memo.resources.filter(r => this.isImageFile(r.filename));
            const otherFiles = memo.resources.filter(r => !this.isImageFile(r.filename));

            if (images.length > 0) {
                documentContent += '\n\n';
                for (const image of images) {
                    const resourceData = await this.memosService.downloadResource(image);
                    if (resourceData) {
                        const resourceDir = `${monthDir}/resources`;
                        await this.ensureDirectoryExists(resourceDir);
                        const localFilename = `${image.name.split('/').pop()}_${this.sanitizeFileName(image.filename)}`;
                        const localPath = `${resourceDir}/${localFilename}`;
                        
                        await this.vault.adapter.writeBinary(localPath, resourceData);
                        const relativePath = this.getRelativePath(filePath, localPath);
                        documentContent += `![${image.filename}](${relativePath})\n`;
                    }
                }
            }

            if (otherFiles.length > 0) {
                documentContent += '\n\n### Attachments\n';
                for (const file of otherFiles) {
                    const resourceData = await this.memosService.downloadResource(file);
                    if (resourceData) {
                        const resourceDir = `${monthDir}/resources`;
                        await this.ensureDirectoryExists(resourceDir);
                        const localFilename = `${file.name.split('/').pop()}_${this.sanitizeFileName(file.filename)}`;
                        const localPath = `${resourceDir}/${localFilename}`;
                        
                        await this.vault.adapter.writeBinary(localPath, resourceData);
                        const relativePath = this.getRelativePath(filePath, localPath);
                        documentContent += `- [${file.filename}](${relativePath})\n`;
                    }
                }
            }
        }

        const tags = (memo.content || '').match(/\#([^\#\s]+)(?:\#|\s|$)/g) || [];
        const cleanTags = tags.map(tag => tag.replace(/^\#|\#$/g, '').trim());
        
        documentContent += '\n\n---\n';
        documentContent += '> [!note]- Memo Properties\n';
        documentContent += `> - Created: ${this.formatDateTime(new Date(memo.createTime))}\n`;
        documentContent += `> - Updated: ${this.formatDateTime(new Date(memo.updateTime))}\n`;
        documentContent += '> - Type: memo\n';
        if (cleanTags.length > 0) {
            documentContent += `> - Tags: [${cleanTags.join(', ')}]\n`;
        }
        documentContent += `> - ID: ${memo.name}\n`;
        documentContent += `> - Visibility: ${memo.visibility.toLowerCase()}\n`;

        try {
            const exists = await this.vault.adapter.exists(filePath);
            if (exists) {
                const file = this.vault.getAbstractFileByPath(filePath) as TFile;
                if (file) {
                    await this.vault.modify(file, documentContent);
                }
            } else {
                await this.vault.create(filePath, documentContent);
            }
            console.log(`Saved memo to: ${filePath}`);
        } catch (error) {
            console.error(`Failed to save memo to file: ${filePath}`, error);
            throw new Error(`Failed to save memo: ${error.message}`);
        }
    }
} 