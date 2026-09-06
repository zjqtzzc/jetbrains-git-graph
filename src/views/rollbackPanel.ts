import * as vscode from "vscode";
import type { EventMessage, RollbackFileInfo } from "../../shared/protocol";
import type { MessageRouter } from "../messages/messageRouter";
import { getWebviewHtml } from "./html";

export type { RollbackFileInfo };

/**
 * 在编辑器标签页里打开一个"回滚改动"webview 面板，
 * 类似 IntelliJ IDEA 的 rollback 对话框。
 */
export class RollbackPanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly messageRouter: MessageRouter,
  ) {}

  open(files: RollbackFileInfo[]): void {
    const filesJson = JSON.stringify(files);

    if (this.panel) {
      this.panel.reveal();
      // 面板已存在：重新发送最新的文件列表
      const msg: EventMessage = {
        type: "event",
        event: "rollbackPanelInit",
        data: { files },
      };
      this.panel.webview.postMessage(msg);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "git-brains.rollbackPanel",
      "Rollback Changes",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")],
        retainContextWhenHidden: false,
      },
    );

    this.panel.webview.html = getWebviewHtml(
      this.panel.webview,
      this.extensionUri,
      "rollback",
      { files: filesJson },
    );

    const routerDisposable = this.messageRouter.registerWebview(
      this.panel.webview,
    );

    this.panel.onDidDispose(() => {
      routerDisposable.dispose();
      this.panel = undefined;
    });
  }

  close(): void {
    this.panel?.dispose();
  }
}
