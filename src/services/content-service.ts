import { AIService } from './ai-service';
import { MemoItem } from '../models/settings';

export class ContentService {
    constructor(private aiService: AIService) {}

    // 处理单个 memo 内容
    async processMemoContent(memo: MemoItem, summaryLanguage: string): Promise<string> {
        let content = memo.content;
        let aiContent = '';

        // 如果启用了智能摘要
        const summary = await this.aiService.generateSummary(content, summaryLanguage);
        if (summary) {
            aiContent += `# AI 摘要\n${summary}\n\n`;
        }

        // 如果启用了自动标签
        const tags = await this.aiService.generateTags(content);
        if (tags && tags.length > 0) {
            aiContent += `# AI 标签\n${tags.map(tag => `#${tag}`).join(' ')}\n\n`;
        }

        // 组合最终内容
        return `${aiContent}${content}`;
    }

    // 生成每周汇总
    async generateWeeklyDigest(memos: MemoItem[]): Promise<string> {
        // 按周分组
        const weekGroups = this.groupMemosByWeek(memos);
        let weeklyContent = '';

        for (const [weekKey, weekMemos] of Object.entries(weekGroups)) {
            const contents = weekMemos.map(memo => memo.content);
            const digest = await this.aiService.generateWeeklyDigest(contents);
            
            weeklyContent += `# ${weekKey} 周报\n\n${digest}\n\n`;
        }

        return weeklyContent;
    }

    // 将 memos 按周分组
    private groupMemosByWeek(memos: MemoItem[]): { [key: string]: MemoItem[] } {
        const groups: { [key: string]: MemoItem[] } = {};

        memos.forEach(memo => {
            const date = new Date(memo.createTime);
            const year = date.getFullYear();
            const week = this.getWeekNumber(date);
            const key = `${year}-W${week.toString().padStart(2, '0')}`;

            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(memo);
        });

        return groups;
    }

    // 获取日期所在的周数
    private getWeekNumber(date: Date): number {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }
} 