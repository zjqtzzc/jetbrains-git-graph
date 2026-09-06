/** 当前检出分支无法快进更新时，由 updateBranch() 抛出该错误。 */
export class BranchDivergedError extends Error {
  constructor(
    public readonly branchName: string,
    public readonly remote: string,
    public readonly remoteBranch: string,
  ) {
    super(`Branch "${branchName}" has diverged from ${remote}/${remoteBranch}`);
    this.name = "BranchDivergedError";
  }
}
