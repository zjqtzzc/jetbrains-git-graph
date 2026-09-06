import type * as vscode from "vscode";
import type {
  EventMessage,
  EventType,
  RequestMessage,
  ResponseMessage,
} from "../../shared/protocol";

export type CommandHandler = (
  params: Record<string, unknown>,
) => Promise<unknown>;

export class MessageRouter {
  private webviews = new Set<vscode.Webview>();
  private handlers = new Map<string, CommandHandler>();

  /** 注册一个命令处理器 */
  handle(command: string, handler: CommandHandler): void {
    this.handlers.set(command, handler);
  }

  /** 注册一个 webview，使其能接收事件、处理请求 */
  registerWebview(webview: vscode.Webview): vscode.Disposable {
    this.webviews.add(webview);

    const messageDisposable = webview.onDidReceiveMessage(
      (msg: RequestMessage) => this.handleRequest(webview, msg),
    );

    return {
      dispose: () => {
        this.webviews.delete(webview);
        messageDisposable.dispose();
      },
    };
  }

  /** 向所有已注册的 webview 广播一个事件 */
  broadcastEvent(event: EventType, data: unknown): void {
    const msg: EventMessage = { type: "event", event, data };
    for (const webview of this.webviews) {
      webview.postMessage(msg);
    }
  }

  private async handleRequest(
    webview: vscode.Webview,
    msg: RequestMessage,
  ): Promise<void> {
    if (msg.type !== "request") {
      return;
    }

    const handler = this.handlers.get(msg.command);
    if (!handler) {
      this.sendResponse(webview, msg.id, false, undefined, {
        message: `Unknown command: ${msg.command}`,
      });
      return;
    }

    try {
      const data = await handler(msg.params);
      this.sendResponse(webview, msg.id, true, data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.sendResponse(webview, msg.id, false, undefined, { message });
    }
  }

  private sendResponse(
    webview: vscode.Webview,
    id: string,
    success: boolean,
    data?: unknown,
    error?: { message: string },
  ): void {
    const response: ResponseMessage = {
      type: "response",
      id,
      success,
      data,
      error,
    };
    webview.postMessage(response);
  }
}
