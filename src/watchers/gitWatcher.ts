import * as vscode from "vscode";
import type { GitCache } from "../git/cache";
import type { MessageRouter } from "../messages/messageRouter";

export class GitWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly workspaceRoot: string,
    private readonly messageRouter: MessageRouter,
    private readonly cache: GitCache,
  ) {
    this.setupFileWatchers();
    this.setupEditorWatchers();
  }

  private setupFileWatchers(): void {
    const gitBase = vscode.Uri.file(`${this.workspaceRoot}/.git`);

    // .git/HEAD（切换分支/checkout）
    const headWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitBase, "HEAD"),
    );
    headWatcher.onDidChange(() => this.notify());
    headWatcher.onDidCreate(() => this.notify());
    headWatcher.onDidDelete(() => this.notify());
    this.disposables.push(headWatcher);

    // .git/refs/heads/**
    const headsWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitBase, "refs/heads/**"),
    );
    headsWatcher.onDidChange(() => this.notify());
    headsWatcher.onDidCreate(() => this.notify());
    headsWatcher.onDidDelete(() => this.notify());
    this.disposables.push(headsWatcher);

    // .git/refs/remotes/**
    const remotesWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitBase, "refs/remotes/**"),
    );
    remotesWatcher.onDidChange(() => this.notify());
    remotesWatcher.onDidCreate(() => this.notify());
    remotesWatcher.onDidDelete(() => this.notify());
    this.disposables.push(remotesWatcher);

    // .git/refs/tags/**
    const tagsWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitBase, "refs/tags/**"),
    );
    tagsWatcher.onDidChange(() => this.notify());
    tagsWatcher.onDidCreate(() => this.notify());
    tagsWatcher.onDidDelete(() => this.notify());
    this.disposables.push(tagsWatcher);

    // .git/refs/stash + .git/logs/refs/stash（shelf/stash 列表）
    // `stash push`/`pop` 也会碰 `index`，能被那边监听到；但
    // `stash drop`/`clear` 只会碰这两个文件。
    const stashRefWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitBase, "refs/stash"),
    );
    stashRefWatcher.onDidChange(() => this.notify());
    stashRefWatcher.onDidCreate(() => this.notify());
    stashRefWatcher.onDidDelete(() => this.notify());
    this.disposables.push(stashRefWatcher);

    const stashLogWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitBase, "logs/refs/stash"),
    );
    stashLogWatcher.onDidChange(() => this.notify());
    stashLogWatcher.onDidCreate(() => this.notify());
    stashLogWatcher.onDidDelete(() => this.notify());
    this.disposables.push(stashLogWatcher);

    // .git/index（暂存区）
    const indexWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitBase, "index"),
    );
    indexWatcher.onDidChange(() => this.notify());
    this.disposables.push(indexWatcher);

    // .git/MERGE_HEAD
    const mergeHeadWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitBase, "MERGE_HEAD"),
    );
    mergeHeadWatcher.onDidChange(() => this.notify());
    mergeHeadWatcher.onDidCreate(() => this.notify());
    mergeHeadWatcher.onDidDelete(() => this.notify());
    this.disposables.push(mergeHeadWatcher);

    // .git/CHERRY_PICK_HEAD（cherry-pick 进行中状态）
    const cherryPickHeadWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitBase, "CHERRY_PICK_HEAD"),
    );
    cherryPickHeadWatcher.onDidChange(() => this.notify());
    cherryPickHeadWatcher.onDidCreate(() => this.notify());
    cherryPickHeadWatcher.onDidDelete(() => this.notify());
    this.disposables.push(cherryPickHeadWatcher);

    // .git/rebase-merge/**（rebase 进行中状态）
    const rebaseMergeWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitBase, "rebase-merge/**"),
    );
    rebaseMergeWatcher.onDidChange(() => this.notify());
    rebaseMergeWatcher.onDidCreate(() => this.notify());
    rebaseMergeWatcher.onDidDelete(() => this.notify());
    this.disposables.push(rebaseMergeWatcher);

    // .git/rebase-apply/**（rebase 进行中状态）
    const rebaseApplyWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitBase, "rebase-apply/**"),
    );
    rebaseApplyWatcher.onDidChange(() => this.notify());
    rebaseApplyWatcher.onDidCreate(() => this.notify());
    rebaseApplyWatcher.onDidDelete(() => this.notify());
    this.disposables.push(rebaseApplyWatcher);

    // .git/COMMIT_EDITMSG（产生了新提交）
    const commitMsgWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitBase, "COMMIT_EDITMSG"),
    );
    commitMsgWatcher.onDidChange(() => this.notify());
    commitMsgWatcher.onDidCreate(() => this.notify());
    this.disposables.push(commitMsgWatcher);
  }

  private setupEditorWatchers(): void {
    // 保存文件 → 刷新（工作区改动）
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(() => this.notify()),
    );
  }

  private notify(): void {
    // 所有监听源共用同一个 300ms 防抖——一次 git 操作（比如 rebase）
    // 可能会短时间内连续触发上面好几个路径的变化。
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this.cache.invalidate();
      this.messageRouter.broadcastEvent("gitStateChanged", {});
    }, 300);
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
