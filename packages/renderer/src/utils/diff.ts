export interface LineDiff {
  type: 'added' | 'removed' | 'unchanged';
  oldLineNum: number | null;
  newLineNum: number | null;
  content: string;
}

export function computeLineDiff(oldContent: string, newContent: string): LineDiff[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const result: LineDiff[] = [];

  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (i === m || j === n) {
        dp[i][j] = 0;
      } else if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  let i = 0;
  let j = 0;
  let oldLine = 1;
  let newLine = 1;

  while (i < m || j < n) {
    if (i < m && j < n && oldLines[i] === newLines[j]) {
      result.push({
        type: 'unchanged',
        oldLineNum: oldLine,
        newLineNum: newLine,
        content: oldLines[i],
      });
      i++;
      j++;
      oldLine++;
      newLine++;
    } else if (j < n && (i === m || dp[i][j + 1] >= dp[i + 1][j])) {
      result.push({
        type: 'added',
        oldLineNum: null,
        newLineNum: newLine,
        content: newLines[j],
      });
      j++;
      newLine++;
    } else {
      result.push({
        type: 'removed',
        oldLineNum: oldLine,
        newLineNum: null,
        content: oldLines[i],
      });
      i++;
      oldLine++;
    }
  }

  return result;
}
