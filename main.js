/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MemosSyncPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  memosApiUrl: "",
  memosAccessToken: "",
  syncDirectory: "memos",
  syncFrequency: "manual",
  autoSyncInterval: 30,
  syncLimit: 1e3
};
var MemosSyncPlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new MemosSyncSettingTab(this.app, this));
    this.addRibbonIcon("sync", "Sync Memos", async () => {
      await this.syncMemos();
    });
    if (this.settings.syncFrequency === "auto") {
      this.initializeAutoSync();
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  initializeAutoSync() {
    const interval = this.settings.autoSyncInterval * 60 * 1e3;
    setInterval(() => this.syncMemos(), interval);
  }
  async fetchAllMemos() {
    try {
      console.log("Fetching memos from:", this.settings.memosApiUrl);
      const allMemos = [];
      let pageToken;
      const pageSize = 100;
      while (allMemos.length < this.settings.syncLimit) {
        const url = new URL(`${this.settings.memosApiUrl}/memos`);
        url.searchParams.set("limit", pageSize.toString());
        url.searchParams.set("offset", "0");
        url.searchParams.set("rowStatus", "NORMAL");
        url.searchParams.set("orderBy", "createdTs");
        url.searchParams.set("orderDirection", "DESC");
        if (pageToken) {
          url.searchParams.set("pageToken", pageToken);
        }
        console.log("Fetching page with URL:", url.toString());
        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${this.settings.memosAccessToken}`,
            "Accept": "application/json"
          }
        });
        console.log("Response status:", response.status);
        const responseText = await response.text();
        console.log("Response text:", responseText);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}
Response: ${responseText}`);
        }
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          throw new Error(`Failed to parse JSON response: ${e.message}
Response: ${responseText}`);
        }
        if (!data.memos || !Array.isArray(data.memos)) {
          throw new Error(`Invalid response format: memos array not found
Response: ${responseText}`);
        }
        allMemos.push(...data.memos);
        console.log(`Fetched ${data.memos.length} memos, total: ${allMemos.length}`);
        if (!data.nextPageToken || allMemos.length >= this.settings.syncLimit) {
          break;
        }
        pageToken = data.nextPageToken;
      }
      const result = allMemos.slice(0, this.settings.syncLimit);
      console.log(`Returning ${result.length} memos after applying limit`);
      return result.sort(
        (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
      );
    } catch (error) {
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        throw new Error(`Network error: Unable to connect to ${this.settings.memosApiUrl}. Please check if the URL is correct and accessible.`);
      }
      throw error;
    }
  }
  sanitizeFileName(fileName) {
    return fileName.replace(/[\\/:*?"<>|#]/g, "_").replace(/\s+/g, " ").trim();
  }
  async saveMemoToFile(memo) {
    const date = new Date(memo.createTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const yearDir = `${this.settings.syncDirectory}/${year}`;
    const monthDir = `${yearDir}/${month}`;
    await this.ensureDirectoryExists(yearDir);
    await this.ensureDirectoryExists(monthDir);
    const timeStr = date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const contentPreview = memo.content ? this.sanitizeFileName(memo.content.slice(0, 20)) : this.sanitizeFileName(memo.name.replace("memos/", ""));
    const fileName = this.sanitizeFileName(`${timeStr} ${contentPreview}.md`);
    const filePath = `${monthDir}/${fileName}`;
    let content = memo.content || "";
    content = content.replace(/\#([^\#\s]+)\#/g, "#$1");
    if (memo.resources && memo.resources.length > 0) {
      content += "\n\n### Attachments\n";
      for (const resource of memo.resources) {
        content += `- [${resource.filename}](${this.settings.memosApiUrl.replace("/api/v1", "")}/o/r/${resource.name})
`;
      }
    }
    const tags = (memo.content || "").match(/\#([^\#\s]+)(?:\#|\s|$)/g) || [];
    const cleanTags = tags.map((tag) => tag.replace(/^\#|\#$/g, "").trim());
    const frontmatter = [
      "---",
      `id: ${memo.name}`,
      `created: ${memo.createTime}`,
      `updated: ${memo.updateTime}`,
      `visibility: ${memo.visibility}`,
      `type: memo`,
      cleanTags.length > 0 ? `tags: [${cleanTags.join(", ")}]` : "tags: []",
      "---",
      "",
      content
    ].filter((line) => line !== void 0).join("\n");
    try {
      const exists = await this.app.vault.adapter.exists(filePath);
      if (exists) {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file) {
          await this.app.vault.modify(file, frontmatter);
        }
      } else {
        await this.app.vault.create(filePath, frontmatter);
      }
    } catch (error) {
      console.error(`Failed to save memo to file: ${filePath}`, error);
      throw new Error(`Failed to save memo: ${error.message}`);
    }
  }
  async ensureDirectoryExists(dirPath) {
    const adapter = this.app.vault.adapter;
    if (!await adapter.exists(dirPath)) {
      await adapter.mkdir(dirPath);
    }
  }
  async syncMemos() {
    try {
      if (!this.settings.memosApiUrl) {
        throw new Error("Memos API URL is not configured");
      }
      if (!this.settings.memosAccessToken) {
        throw new Error("Memos Access Token is not configured");
      }
      this.displayMessage("Sync started");
      await this.ensureDirectoryExists(this.settings.syncDirectory);
      const memos = await this.fetchAllMemos();
      this.displayMessage(`Found ${memos.length} memos`);
      let syncCount = 0;
      for (const memo of memos) {
        await this.saveMemoToFile(memo);
        syncCount++;
      }
      this.displayMessage(`Successfully synced ${syncCount} memos`);
    } catch (error) {
      console.error("Sync failed:", error);
      this.displayMessage("Sync failed: " + error.message, true);
    }
  }
  displayMessage(message, isError = false) {
    new import_obsidian.Notice(message);
  }
};
var MemosSyncSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Memos API URL").setDesc("Enter your Memos API URL (e.g., https://your-memos-host/api/v1)").addText((text) => text.setPlaceholder("https://your-memos-host/api/v1").setValue(this.plugin.settings.memosApiUrl).onChange(async (value) => {
      let url = value.trim();
      if (url && !url.endsWith("/api/v1")) {
        url = url.replace(/\/?$/, "/api/v1");
        text.setValue(url);
      }
      this.plugin.settings.memosApiUrl = url;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Memos Access Token").setDesc("Enter your Memos Access Token").addText((text) => text.setPlaceholder("your-access-token").setValue(this.plugin.settings.memosAccessToken).onChange(async (value) => {
      this.plugin.settings.memosAccessToken = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Sync Directory").setDesc("Directory where memos will be synced").addText((text) => text.setPlaceholder("memos").setValue(this.plugin.settings.syncDirectory).onChange(async (value) => {
      this.plugin.settings.syncDirectory = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Sync Limit").setDesc("Maximum number of memos to sync (default: 1000)").addText((text) => text.setPlaceholder("1000").setValue(String(this.plugin.settings.syncLimit)).onChange(async (value) => {
      const numValue = parseInt(value);
      if (!isNaN(numValue) && numValue > 0) {
        this.plugin.settings.syncLimit = numValue;
        await this.plugin.saveSettings();
      }
    }));
    new import_obsidian.Setting(containerEl).setName("Sync Frequency").setDesc("Choose how often to sync").addDropdown((dropdown) => dropdown.addOption("manual", "Manual").addOption("auto", "Automatic").setValue(this.plugin.settings.syncFrequency).onChange(async (value) => {
      this.plugin.settings.syncFrequency = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Auto Sync Interval").setDesc("How often to sync (in minutes) when auto sync is enabled").addText((text) => text.setPlaceholder("30").setValue(String(this.plugin.settings.autoSyncInterval)).onChange(async (value) => {
      const numValue = parseInt(value);
      if (!isNaN(numValue) && numValue > 0) {
        this.plugin.settings.autoSyncInterval = numValue;
        await this.plugin.saveSettings();
      }
    }));
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgQXBwLCBQbHVnaW4sIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcsIE5vdGljZSwgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5cbmludGVyZmFjZSBNZW1vSXRlbSB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHVpZDogc3RyaW5nO1xuICAgIGNvbnRlbnQ6IHN0cmluZztcbiAgICB2aXNpYmlsaXR5OiBzdHJpbmc7XG4gICAgY3JlYXRlVGltZTogc3RyaW5nO1xuICAgIHVwZGF0ZVRpbWU6IHN0cmluZztcbiAgICBkaXNwbGF5VGltZTogc3RyaW5nO1xuICAgIGNyZWF0b3I6IHN0cmluZztcbiAgICByb3dTdGF0dXM6IHN0cmluZztcbiAgICBwaW5uZWQ6IGJvb2xlYW47XG4gICAgcmVzb3VyY2VzOiBBcnJheTx7XG4gICAgICAgIG5hbWU6IHN0cmluZztcbiAgICAgICAgdWlkOiBzdHJpbmc7XG4gICAgICAgIGZpbGVuYW1lOiBzdHJpbmc7XG4gICAgICAgIHR5cGU6IHN0cmluZztcbiAgICAgICAgc2l6ZTogc3RyaW5nO1xuICAgICAgICBjcmVhdGVUaW1lOiBzdHJpbmc7XG4gICAgfT47XG4gICAgdGFnczogc3RyaW5nW107XG59XG5cbmludGVyZmFjZSBNZW1vc1Jlc3BvbnNlIHtcbiAgICBtZW1vczogTWVtb0l0ZW1bXTtcbiAgICBuZXh0UGFnZVRva2VuPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgTWVtb3NQbHVnaW5TZXR0aW5ncyB7XG4gICAgbWVtb3NBcGlVcmw6IHN0cmluZztcbiAgICBtZW1vc0FjY2Vzc1Rva2VuOiBzdHJpbmc7XG4gICAgc3luY0RpcmVjdG9yeTogc3RyaW5nO1xuICAgIHN5bmNGcmVxdWVuY3k6ICdtYW51YWwnIHwgJ2F1dG8nO1xuICAgIGF1dG9TeW5jSW50ZXJ2YWw6IG51bWJlcjtcbiAgICBzeW5jTGltaXQ6IG51bWJlcjtcbn1cblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogTWVtb3NQbHVnaW5TZXR0aW5ncyA9IHtcbiAgICBtZW1vc0FwaVVybDogJycsXG4gICAgbWVtb3NBY2Nlc3NUb2tlbjogJycsXG4gICAgc3luY0RpcmVjdG9yeTogJ21lbW9zJyxcbiAgICBzeW5jRnJlcXVlbmN5OiAnbWFudWFsJyxcbiAgICBhdXRvU3luY0ludGVydmFsOiAzMCxcbiAgICBzeW5jTGltaXQ6IDEwMDBcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWVtb3NTeW5jUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgICBzZXR0aW5nczogTWVtb3NQbHVnaW5TZXR0aW5ncztcblxuICAgIGFzeW5jIG9ubG9hZCgpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblxuICAgICAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IE1lbW9zU3luY1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgICAgICB0aGlzLmFkZFJpYmJvbkljb24oJ3N5bmMnLCAnU3luYyBNZW1vcycsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc3luY01lbW9zKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICh0aGlzLnNldHRpbmdzLnN5bmNGcmVxdWVuY3kgPT09ICdhdXRvJykge1xuICAgICAgICAgICAgdGhpcy5pbml0aWFsaXplQXV0b1N5bmMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcbiAgICAgICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG4gICAgfVxuXG4gICAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgICAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICAgIH1cblxuICAgIHByaXZhdGUgaW5pdGlhbGl6ZUF1dG9TeW5jKCkge1xuICAgICAgICBjb25zdCBpbnRlcnZhbCA9IHRoaXMuc2V0dGluZ3MuYXV0b1N5bmNJbnRlcnZhbCAqIDYwICogMTAwMDtcbiAgICAgICAgc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy5zeW5jTWVtb3MoKSwgaW50ZXJ2YWwpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZmV0Y2hBbGxNZW1vcygpOiBQcm9taXNlPE1lbW9JdGVtW10+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdGZXRjaGluZyBtZW1vcyBmcm9tOicsIHRoaXMuc2V0dGluZ3MubWVtb3NBcGlVcmwpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBhbGxNZW1vczogTWVtb0l0ZW1bXSA9IFtdO1xuICAgICAgICAgICAgbGV0IHBhZ2VUb2tlbjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICAgICAgY29uc3QgcGFnZVNpemUgPSAxMDA7IC8vIFx1NkJDRlx1OTg3NVx1ODNCN1x1NTNENjEwMFx1Njc2MVx1OEJCMFx1NUY1NVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBcdTVGQUFcdTczQUZcdTgzQjdcdTUzRDZcdTYyNDBcdTY3MDlcdTk4NzVcdTk3NjJcdTc2ODRcdTY1NzBcdTYzNkVcdUZGMENcdTc2RjRcdTUyMzBcdThGQkVcdTUyMzBcdTk2NTBcdTUyMzZcdTYyMTZcdTZDQTFcdTY3MDlcdTY2RjRcdTU5MUFcdTY1NzBcdTYzNkVcbiAgICAgICAgICAgIHdoaWxlIChhbGxNZW1vcy5sZW5ndGggPCB0aGlzLnNldHRpbmdzLnN5bmNMaW1pdCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoYCR7dGhpcy5zZXR0aW5ncy5tZW1vc0FwaVVybH0vbWVtb3NgKTtcbiAgICAgICAgICAgICAgICB1cmwuc2VhcmNoUGFyYW1zLnNldCgnbGltaXQnLCBwYWdlU2l6ZS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB1cmwuc2VhcmNoUGFyYW1zLnNldCgnb2Zmc2V0JywgJzAnKTtcbiAgICAgICAgICAgICAgICB1cmwuc2VhcmNoUGFyYW1zLnNldCgncm93U3RhdHVzJywgJ05PUk1BTCcpO1xuICAgICAgICAgICAgICAgIHVybC5zZWFyY2hQYXJhbXMuc2V0KCdvcmRlckJ5JywgJ2NyZWF0ZWRUcycpO1xuICAgICAgICAgICAgICAgIHVybC5zZWFyY2hQYXJhbXMuc2V0KCdvcmRlckRpcmVjdGlvbicsICdERVNDJyk7XG4gICAgICAgICAgICAgICAgaWYgKHBhZ2VUb2tlbikge1xuICAgICAgICAgICAgICAgICAgICB1cmwuc2VhcmNoUGFyYW1zLnNldCgncGFnZVRva2VuJywgcGFnZVRva2VuKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRmV0Y2hpbmcgcGFnZSB3aXRoIFVSTDonLCB1cmwudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwudG9TdHJpbmcoKSwge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHt0aGlzLnNldHRpbmdzLm1lbW9zQWNjZXNzVG9rZW59YCxcbiAgICAgICAgICAgICAgICAgICAgICAgICdBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1Jlc3BvbnNlIHN0YXR1czonLCByZXNwb25zZS5zdGF0dXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnUmVzcG9uc2UgdGV4dDonLCByZXNwb25zZVRleHQpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9OiAke3Jlc3BvbnNlLnN0YXR1c1RleHR9XFxuUmVzcG9uc2U6ICR7cmVzcG9uc2VUZXh0fWApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGxldCBkYXRhOiBNZW1vc1Jlc3BvbnNlO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEgPSBKU09OLnBhcnNlKHJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBwYXJzZSBKU09OIHJlc3BvbnNlOiAke2UubWVzc2FnZX1cXG5SZXNwb25zZTogJHtyZXNwb25zZVRleHR9YCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFkYXRhLm1lbW9zIHx8ICFBcnJheS5pc0FycmF5KGRhdGEubWVtb3MpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCByZXNwb25zZSBmb3JtYXQ6IG1lbW9zIGFycmF5IG5vdCBmb3VuZFxcblJlc3BvbnNlOiAke3Jlc3BvbnNlVGV4dH1gKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhbGxNZW1vcy5wdXNoKC4uLmRhdGEubWVtb3MpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBGZXRjaGVkICR7ZGF0YS5tZW1vcy5sZW5ndGh9IG1lbW9zLCB0b3RhbDogJHthbGxNZW1vcy5sZW5ndGh9YCk7XG5cbiAgICAgICAgICAgICAgICAvLyBcdTU5ODJcdTY3OUNcdTZDQTFcdTY3MDlcdTRFMEJcdTRFMDBcdTk4NzVcdUZGMENcdTYyMTZcdTgwMDVcdTVERjJcdTdFQ0ZcdThGQkVcdTUyMzBcdTk2NTBcdTUyMzZcdUZGMENcdTVDMzFcdTkwMDBcdTUxRkFcbiAgICAgICAgICAgICAgICBpZiAoIWRhdGEubmV4dFBhZ2VUb2tlbiB8fCBhbGxNZW1vcy5sZW5ndGggPj0gdGhpcy5zZXR0aW5ncy5zeW5jTGltaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHBhZ2VUb2tlbiA9IGRhdGEubmV4dFBhZ2VUb2tlbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gXHU1OTgyXHU2NzlDXHU4RDg1XHU4RkM3XHU5NjUwXHU1MjM2XHVGRjBDXHU1M0VBXHU4RkQ0XHU1NkRFXHU5NjUwXHU1MjM2XHU2NTcwXHU5MUNGXHU3Njg0XHU2NzYxXHU3NkVFXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhbGxNZW1vcy5zbGljZSgwLCB0aGlzLnNldHRpbmdzLnN5bmNMaW1pdCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgUmV0dXJuaW5nICR7cmVzdWx0Lmxlbmd0aH0gbWVtb3MgYWZ0ZXIgYXBwbHlpbmcgbGltaXRgKTtcblxuICAgICAgICAgICAgLy8gXHU3ODZFXHU0RkREXHU2MzA5XHU1MjFCXHU1RUZBXHU2NUY2XHU5NUY0XHU1MDEyXHU1RThGXHU2MzkyXHU1RThGXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0LnNvcnQoKGEsIGIpID0+IFxuICAgICAgICAgICAgICAgIG5ldyBEYXRlKGIuY3JlYXRlVGltZSkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5jcmVhdGVUaW1lKS5nZXRUaW1lKClcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBUeXBlRXJyb3IgJiYgZXJyb3IubWVzc2FnZSA9PT0gJ0ZhaWxlZCB0byBmZXRjaCcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5ldHdvcmsgZXJyb3I6IFVuYWJsZSB0byBjb25uZWN0IHRvICR7dGhpcy5zZXR0aW5ncy5tZW1vc0FwaVVybH0uIFBsZWFzZSBjaGVjayBpZiB0aGUgVVJMIGlzIGNvcnJlY3QgYW5kIGFjY2Vzc2libGUuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2FuaXRpemVGaWxlTmFtZShmaWxlTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgLy8gXHU3OUZCXHU5NjY0XHU2MjE2XHU2NkZGXHU2MzYyXHU0RTBEXHU1Qjg5XHU1MTY4XHU3Njg0XHU1QjU3XHU3QjI2XG4gICAgICAgIHJldHVybiBmaWxlTmFtZVxuICAgICAgICAgICAgLnJlcGxhY2UoL1tcXFxcLzoqP1wiPD58I10vZywgJ18nKSAvLyBcdTY2RkZcdTYzNjIgV2luZG93cyBcdTRFMERcdTUxNDFcdThCQjhcdTc2ODRcdTVCNTdcdTdCMjZcdTU0OEMgIyBcdTdCMjZcdTUzRjdcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHMrL2csICcgJykgICAgICAgICAgIC8vIFx1NUMwNlx1NTkxQVx1NEUyQVx1N0E3QVx1NjgzQ1x1NjZGRlx1NjM2Mlx1NEUzQVx1NTM1NVx1NEUyQVx1N0E3QVx1NjgzQ1xuICAgICAgICAgICAgLnRyaW0oKTsgICAgICAgICAgICAgICAgICAgICAgICAvLyBcdTc5RkJcdTk2NjRcdTk5OTZcdTVDM0VcdTdBN0FcdTY4M0NcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNhdmVNZW1vVG9GaWxlKG1lbW86IE1lbW9JdGVtKSB7XG4gICAgICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZShtZW1vLmNyZWF0ZVRpbWUpO1xuICAgICAgICBjb25zdCB5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xuICAgICAgICBjb25zdCBtb250aCA9IFN0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgeWVhckRpciA9IGAke3RoaXMuc2V0dGluZ3Muc3luY0RpcmVjdG9yeX0vJHt5ZWFyfWA7XG4gICAgICAgIGNvbnN0IG1vbnRoRGlyID0gYCR7eWVhckRpcn0vJHttb250aH1gO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgdGhpcy5lbnN1cmVEaXJlY3RvcnlFeGlzdHMoeWVhckRpcik7XG4gICAgICAgIGF3YWl0IHRoaXMuZW5zdXJlRGlyZWN0b3J5RXhpc3RzKG1vbnRoRGlyKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHRpbWVTdHIgPSBkYXRlLnRvSVNPU3RyaW5nKCkucmVwbGFjZSgvWzouXS9nLCAnLScpLnNsaWNlKDAsIDE5KTtcbiAgICAgICAgY29uc3QgY29udGVudFByZXZpZXcgPSBtZW1vLmNvbnRlbnQgXG4gICAgICAgICAgICA/IHRoaXMuc2FuaXRpemVGaWxlTmFtZShtZW1vLmNvbnRlbnQuc2xpY2UoMCwgMjApKVxuICAgICAgICAgICAgOiB0aGlzLnNhbml0aXplRmlsZU5hbWUobWVtby5uYW1lLnJlcGxhY2UoJ21lbW9zLycsICcnKSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBmaWxlTmFtZSA9IHRoaXMuc2FuaXRpemVGaWxlTmFtZShgJHt0aW1lU3RyfSAke2NvbnRlbnRQcmV2aWV3fS5tZGApO1xuICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGAke21vbnRoRGlyfS8ke2ZpbGVOYW1lfWA7XG4gICAgICAgIFxuICAgICAgICBsZXQgY29udGVudCA9IG1lbW8uY29udGVudCB8fCAnJztcbiAgICAgICAgXG4gICAgICAgIC8vIFx1NTkwNFx1NzQwNlx1NjgwN1x1N0I3RVx1RkYxQVx1NUMwNiAjdGFnIyBcdTY4M0NcdTVGMEZcdThGNkNcdTYzNjJcdTRFM0EgI3RhZ1xuICAgICAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKC9cXCMoW15cXCNcXHNdKylcXCMvZywgJyMkMScpO1xuICAgICAgICBcbiAgICAgICAgaWYgKG1lbW8ucmVzb3VyY2VzICYmIG1lbW8ucmVzb3VyY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnRlbnQgKz0gJ1xcblxcbiMjIyBBdHRhY2htZW50c1xcbic7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlc291cmNlIG9mIG1lbW8ucmVzb3VyY2VzKSB7XG4gICAgICAgICAgICAgICAgY29udGVudCArPSBgLSBbJHtyZXNvdXJjZS5maWxlbmFtZX1dKCR7dGhpcy5zZXR0aW5ncy5tZW1vc0FwaVVybC5yZXBsYWNlKCcvYXBpL3YxJywgJycpfS9vL3IvJHtyZXNvdXJjZS5uYW1lfSlcXG5gO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gXHU2M0QwXHU1M0Q2XHU2ODA3XHU3QjdFXG4gICAgICAgIGNvbnN0IHRhZ3MgPSAobWVtby5jb250ZW50IHx8ICcnKS5tYXRjaCgvXFwjKFteXFwjXFxzXSspKD86XFwjfFxcc3wkKS9nKSB8fCBbXTtcbiAgICAgICAgY29uc3QgY2xlYW5UYWdzID0gdGFncy5tYXAodGFnID0+IHRhZy5yZXBsYWNlKC9eXFwjfFxcIyQvZywgJycpLnRyaW0oKSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBmcm9udG1hdHRlciA9IFtcbiAgICAgICAgICAgICctLS0nLFxuICAgICAgICAgICAgYGlkOiAke21lbW8ubmFtZX1gLFxuICAgICAgICAgICAgYGNyZWF0ZWQ6ICR7bWVtby5jcmVhdGVUaW1lfWAsXG4gICAgICAgICAgICBgdXBkYXRlZDogJHttZW1vLnVwZGF0ZVRpbWV9YCxcbiAgICAgICAgICAgIGB2aXNpYmlsaXR5OiAke21lbW8udmlzaWJpbGl0eX1gLFxuICAgICAgICAgICAgYHR5cGU6IG1lbW9gLFxuICAgICAgICAgICAgY2xlYW5UYWdzLmxlbmd0aCA+IDAgPyBgdGFnczogWyR7Y2xlYW5UYWdzLmpvaW4oJywgJyl9XWAgOiAndGFnczogW10nLFxuICAgICAgICAgICAgJy0tLScsXG4gICAgICAgICAgICAnJyxcbiAgICAgICAgICAgIGNvbnRlbnRcbiAgICAgICAgXS5maWx0ZXIobGluZSA9PiBsaW5lICE9PSB1bmRlZmluZWQpLmpvaW4oJ1xcbicpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBleGlzdHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cyhmaWxlUGF0aCk7XG4gICAgICAgICAgICBpZiAoZXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCkgYXMgVEZpbGU7XG4gICAgICAgICAgICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KGZpbGUsIGZyb250bWF0dGVyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZShmaWxlUGF0aCwgZnJvbnRtYXR0ZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHNhdmUgbWVtbyB0byBmaWxlOiAke2ZpbGVQYXRofWAsIGVycm9yKTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHNhdmUgbWVtbzogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBlbnN1cmVEaXJlY3RvcnlFeGlzdHMoZGlyUGF0aDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGFkYXB0ZXIgPSB0aGlzLmFwcC52YXVsdC5hZGFwdGVyO1xuICAgICAgICBpZiAoIShhd2FpdCBhZGFwdGVyLmV4aXN0cyhkaXJQYXRoKSkpIHtcbiAgICAgICAgICAgIGF3YWl0IGFkYXB0ZXIubWtkaXIoZGlyUGF0aCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBzeW5jTWVtb3MoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuc2V0dGluZ3MubWVtb3NBcGlVcmwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01lbW9zIEFQSSBVUkwgaXMgbm90IGNvbmZpZ3VyZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghdGhpcy5zZXR0aW5ncy5tZW1vc0FjY2Vzc1Rva2VuKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNZW1vcyBBY2Nlc3MgVG9rZW4gaXMgbm90IGNvbmZpZ3VyZWQnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5kaXNwbGF5TWVzc2FnZSgnU3luYyBzdGFydGVkJyk7XG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuZW5zdXJlRGlyZWN0b3J5RXhpc3RzKHRoaXMuc2V0dGluZ3Muc3luY0RpcmVjdG9yeSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IG1lbW9zID0gYXdhaXQgdGhpcy5mZXRjaEFsbE1lbW9zKCk7XG4gICAgICAgICAgICB0aGlzLmRpc3BsYXlNZXNzYWdlKGBGb3VuZCAke21lbW9zLmxlbmd0aH0gbWVtb3NgKTtcblxuICAgICAgICAgICAgbGV0IHN5bmNDb3VudCA9IDA7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG1lbW8gb2YgbWVtb3MpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNhdmVNZW1vVG9GaWxlKG1lbW8pO1xuICAgICAgICAgICAgICAgIHN5bmNDb3VudCsrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmRpc3BsYXlNZXNzYWdlKGBTdWNjZXNzZnVsbHkgc3luY2VkICR7c3luY0NvdW50fSBtZW1vc2ApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignU3luYyBmYWlsZWQ6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhpcy5kaXNwbGF5TWVzc2FnZSgnU3luYyBmYWlsZWQ6ICcgKyBlcnJvci5tZXNzYWdlLCB0cnVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZGlzcGxheU1lc3NhZ2UobWVzc2FnZTogc3RyaW5nLCBpc0Vycm9yID0gZmFsc2UpIHtcbiAgICAgICAgbmV3IE5vdGljZShtZXNzYWdlKTtcbiAgICB9XG59XG5cbmNsYXNzIE1lbW9zU3luY1NldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgICBwbHVnaW46IE1lbW9zU3luY1BsdWdpbjtcblxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE1lbW9zU3luY1BsdWdpbikge1xuICAgICAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIH1cblxuICAgIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZSgnTWVtb3MgQVBJIFVSTCcpXG4gICAgICAgICAgICAuc2V0RGVzYygnRW50ZXIgeW91ciBNZW1vcyBBUEkgVVJMIChlLmcuLCBodHRwczovL3lvdXItbWVtb3MtaG9zdC9hcGkvdjEpJylcbiAgICAgICAgICAgIC5hZGRUZXh0KHRleHQgPT4gdGV4dFxuICAgICAgICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignaHR0cHM6Ly95b3VyLW1lbW9zLWhvc3QvYXBpL3YxJylcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubWVtb3NBcGlVcmwpXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgdXJsID0gdmFsdWUudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodXJsICYmICF1cmwuZW5kc1dpdGgoJy9hcGkvdjEnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXJsID0gdXJsLnJlcGxhY2UoL1xcLz8kLywgJy9hcGkvdjEnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHQuc2V0VmFsdWUodXJsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tZW1vc0FwaVVybCA9IHVybDtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoJ01lbW9zIEFjY2VzcyBUb2tlbicpXG4gICAgICAgICAgICAuc2V0RGVzYygnRW50ZXIgeW91ciBNZW1vcyBBY2Nlc3MgVG9rZW4nKVxuICAgICAgICAgICAgLmFkZFRleHQodGV4dCA9PiB0ZXh0XG4gICAgICAgICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCd5b3VyLWFjY2Vzcy10b2tlbicpXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm1lbW9zQWNjZXNzVG9rZW4pXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tZW1vc0FjY2Vzc1Rva2VuID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICAgIH0pKTtcblxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgICAgICAgIC5zZXROYW1lKCdTeW5jIERpcmVjdG9yeScpXG4gICAgICAgICAgICAuc2V0RGVzYygnRGlyZWN0b3J5IHdoZXJlIG1lbW9zIHdpbGwgYmUgc3luY2VkJylcbiAgICAgICAgICAgIC5hZGRUZXh0KHRleHQgPT4gdGV4dFxuICAgICAgICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignbWVtb3MnKVxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zeW5jRGlyZWN0b3J5KVxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc3luY0RpcmVjdG9yeSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZSgnU3luYyBMaW1pdCcpXG4gICAgICAgICAgICAuc2V0RGVzYygnTWF4aW11bSBudW1iZXIgb2YgbWVtb3MgdG8gc3luYyAoZGVmYXVsdDogMTAwMCknKVxuICAgICAgICAgICAgLmFkZFRleHQodGV4dCA9PiB0ZXh0XG4gICAgICAgICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCcxMDAwJylcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUoU3RyaW5nKHRoaXMucGx1Z2luLnNldHRpbmdzLnN5bmNMaW1pdCkpXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBudW1WYWx1ZSA9IHBhcnNlSW50KHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihudW1WYWx1ZSkgJiYgbnVtVmFsdWUgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zeW5jTGltaXQgPSBudW1WYWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoJ1N5bmMgRnJlcXVlbmN5JylcbiAgICAgICAgICAgIC5zZXREZXNjKCdDaG9vc2UgaG93IG9mdGVuIHRvIHN5bmMnKVxuICAgICAgICAgICAgLmFkZERyb3Bkb3duKGRyb3Bkb3duID0+IGRyb3Bkb3duXG4gICAgICAgICAgICAgICAgLmFkZE9wdGlvbignbWFudWFsJywgJ01hbnVhbCcpXG4gICAgICAgICAgICAgICAgLmFkZE9wdGlvbignYXV0bycsICdBdXRvbWF0aWMnKVxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zeW5jRnJlcXVlbmN5KVxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWU6ICdtYW51YWwnIHwgJ2F1dG8nKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnN5bmNGcmVxdWVuY3kgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoJ0F1dG8gU3luYyBJbnRlcnZhbCcpXG4gICAgICAgICAgICAuc2V0RGVzYygnSG93IG9mdGVuIHRvIHN5bmMgKGluIG1pbnV0ZXMpIHdoZW4gYXV0byBzeW5jIGlzIGVuYWJsZWQnKVxuICAgICAgICAgICAgLmFkZFRleHQodGV4dCA9PiB0ZXh0XG4gICAgICAgICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCczMCcpXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvU3luY0ludGVydmFsKSlcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG51bVZhbHVlID0gcGFyc2VJbnQodmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKG51bVZhbHVlKSAmJiBudW1WYWx1ZSA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9TeW5jSW50ZXJ2YWwgPSBudW1WYWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSkpO1xuICAgIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFBc0U7QUFzQ3RFLElBQU0sbUJBQXdDO0FBQUEsRUFDMUMsYUFBYTtBQUFBLEVBQ2Isa0JBQWtCO0FBQUEsRUFDbEIsZUFBZTtBQUFBLEVBQ2YsZUFBZTtBQUFBLEVBQ2Ysa0JBQWtCO0FBQUEsRUFDbEIsV0FBVztBQUNmO0FBRUEsSUFBcUIsa0JBQXJCLGNBQTZDLHVCQUFPO0FBQUEsRUFHaEQsTUFBTSxTQUFTO0FBQ1gsVUFBTSxLQUFLLGFBQWE7QUFFeEIsU0FBSyxjQUFjLElBQUksb0JBQW9CLEtBQUssS0FBSyxJQUFJLENBQUM7QUFFMUQsU0FBSyxjQUFjLFFBQVEsY0FBYyxZQUFZO0FBQ2pELFlBQU0sS0FBSyxVQUFVO0FBQUEsSUFDekIsQ0FBQztBQUVELFFBQUksS0FB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
