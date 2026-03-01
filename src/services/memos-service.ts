import type { MemoItem } from '../models/settings';
import { Logger } from './logger';
import { requestUrl, RequestUrlResponse } from 'obsidian';

export interface MemosResponse {
    memos: MemoItem[];
    nextPageToken?: string;
}

export class MemosService {
    private logger: Logger;

    constructor(
        private apiUrl: string,
        private accessToken: string,
        private syncLimit: number
    ) {
        this.logger = new Logger('MemosService');
    }

    /**
     * Extracts the user ID from the JWT access token's `sub` claim.
     * Required for Memos v0.22+: GET /api/v1/memos only returns public memos,
     * while GET /api/v1/users/{id}/memos returns the authenticated user's own memos.
     */
    private getUserIdFromToken(): string | null {
        try {
            const payload = JSON.parse(
                atob(this.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
            );
            return payload.sub ?? null;
        } catch {
            return null;
        }
    }

    async fetchAllMemos(): Promise<MemoItem[]> {
        try {
            this.logger.debug('开始获取 memos，API URL:', this.apiUrl);
            this.logger.debug('Access Token:', this.accessToken ? '已设置' : '未设置');
            this.logger.debug('同步限制:', this.syncLimit, '条');

            const allMemos: MemoItem[] = [];
            let pageToken: string | undefined;
            const pageSize = Math.min(100, this.syncLimit);

            // 验证 API URL 格式
            if (!this.apiUrl.includes('/api/v1')) {
                throw new Error('API URL 格式不正确，请确保包含 /api/v1');
            }

            // Memos v0.22+ requires user-scoped endpoint to retrieve private memos.
            // /api/v1/memos only returns public memos from all users.
            const userId = this.getUserIdFromToken();
            this.logger.debug('User ID from token:', userId);

            do {
                const baseUrl = this.apiUrl;
                const url = userId ? `${baseUrl}/users/${userId}/memos` : `${baseUrl}/memos`;

                // 构建请求参数
                const params = new URLSearchParams({
                    'rowStatus': 'NORMAL',
                    'limit': pageSize.toString()
                });

                if (pageToken) {
                    params.set('pageToken', pageToken);
                }

                const finalUrl = `${url}?${params.toString()}`;
                this.logger.debug('请求 URL:', finalUrl);

                const response = await requestUrl({
                    url: finalUrl,
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Accept': 'application/json'
                    }
                });

                if (response.status !== 200) {
                    throw new Error(`HTTP ${response.status}: 请求失败\n响应内容: ${response.text}`);
                }

                const responseData = response.json;
                this.logger.debug('API 响应数据:', responseData);

                if (!responseData || !Array.isArray(responseData.memos)) {
                    throw new Error('响应格式无效: 返回数据不包含 memos 数组');
                }

                const memos = responseData.memos;
                pageToken = responseData.nextPageToken;

                if (memos.length === 0) {
                    break; // 没有更多数据了
                }

                // 只添加需要的数量
                const remainingCount = this.syncLimit - allMemos.length;
                const neededCount = Math.min(memos.length, remainingCount);
                allMemos.push(...memos.slice(0, neededCount));
                this.logger.debug(`本次获取 ${neededCount} 条 memos，总计: ${allMemos.length}/${this.syncLimit}`);

                // 如果已经达到同步限制或没有下一页，就退出
                if (allMemos.length >= this.syncLimit || !pageToken) {
                    break;
                }

            } while (true);

            this.logger.debug(`最终返回 ${allMemos.length} 条 memos`);
            return allMemos.sort((a, b) => 
                new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
            );
        } catch (error) {
            this.logger.error('获取 memos 失败:', error);
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                throw new Error(`网络错误: 无法连接到 ${this.apiUrl}。请检查 URL 是否正确且可访问。`);
            }
            throw error;
        }
    }

    async downloadResource(resource: { name: string; filename: string; type?: string }): Promise<ArrayBuffer | null> {
        try {
            const resourceId = resource.name.split('/').pop() || resource.name;
            const resourceUrl = `${this.apiUrl.replace('/api/v1', '')}/file/resources/${resourceId}/${encodeURIComponent(resource.filename)}`;

            this.logger.debug(`正在下载资源: ${resourceUrl}`);

            const response = await requestUrl({
                url: resourceUrl,
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.status !== 200) {
                this.logger.error(`下载资源失败: ${response.status}`);
                return null;
            }

            return response.arrayBuffer;
        } catch (error) {
            this.logger.error('下载资源时出错:', error);
            return null;
        }
    }
} 