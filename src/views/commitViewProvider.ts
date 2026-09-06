import * as vscode from "vscode";
import type { GitCache } from "../git/cache";
import type { MessageRouter } from "../messages/messageRouter";
import { getWebviewHtml } from "./html";

export class CommitViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "git-brains.commitPanel";

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly messageRouter: MessageRouter,
    private readonly caches: GitCache[] = [],
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    const webview = webviewView.webview;

    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")],
    };

    webview.html = getWebviewHtml(webview, this.extensionUri, "commit");

    const routerDisposable = this.messageRouter.registerWebview(webview);
    webviewView.onDidDispose(() => routerDisposable.dispose());

    // 首次打开：延迟一段时间后聚焦到 git log 面板
    setTimeout(() => {
      if (webviewView.visible) {
        void vscode.commands.executeCommand("git-brains.gitLog.focus");
        for (const cache of this.caches) {
          cache.invalidate();
        }
        this.messageRouter.broadcastEvent("commitStateChanged", {});
        this.messageRouter.broadcastEvent("gitStateChanged", {});
      }
    }, 200);

    // Commit 面板变为可见时，同步显示 Git Log 面板并刷新两者
    // 隐藏时（再次点击收起）也把 Git Log 面板一起隐藏
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        // 稍微延迟一下，确保面板都准备好了
        setTimeout(() => {
          void vscode.commands.executeCommand("git-brains.gitLog.focus");
          // 清空所有 git 缓存，确保拿到的是最新数据
          for (const cache of this.caches) {
            cache.invalidate();
          }
          this.messageRouter.broadcastEvent("commitStateChanged", {});
          this.messageRouter.broadcastEvent("gitStateChanged", {});
        }, 100);
      } else {
        void vscode.commands.executeCommand("workbench.action.closePanel");
      }
    });
  }
}
