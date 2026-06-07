import React, { useState, useMemo } from 'react';
import { CommitInfo, BranchInfo } from '../types';

interface CommitGraphProps {
  commits: CommitInfo[];
  branches: BranchInfo[];
  onSelectDiff: (oldCommit: string, newCommit: string) => void;
}

interface GraphNode {
  commit: CommitInfo;
  x: number;
  y: number;
  branch: number;
}

interface GraphEdge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  branch: number;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000);
  return date.toLocaleString();
}

function truncateHash(hash: string): string {
  return hash.slice(0, 7);
}

export default function CommitGraph({ commits, branches, onSelectDiff }: CommitGraphProps) {
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    if (commits.length === 0) {
      return { nodes, edges };
    }

    const commitToBranch = new Map<string, number>();
    const branchHeads = new Map<string, number>();
    let nextBranch = 0;

    const sortedCommits = [...commits].sort((a, b) => b.timestamp - a.timestamp);

    for (let i = 0; i < sortedCommits.length; i++) {
      const commit = sortedCommits[i];

      let branch = commitToBranch.get(commit.id);
      if (branch === undefined) {
        branch = nextBranch++;
        commitToBranch.set(commit.id, branch);
      }

      const commitBranches = branches.filter((b) => b.commit_id === commit.id);
      commitBranches.forEach((b) => {
        if (!branchHeads.has(b.name)) {
          branchHeads.set(b.name, branch!);
        }
      });

      nodes.push({
        commit,
        x: branch * 40 + 20,
        y: i * 60 + 30,
        branch,
      });

      for (const parentId of commit.parents) {
        let parentBranch = commitToBranch.get(parentId);
        if (parentBranch === undefined) {
          parentBranch = nextBranch++;
          commitToBranch.set(parentId, parentBranch);
        }

        const parentIndex = sortedCommits.findIndex((c) => c.id === parentId);
        if (parentIndex !== -1) {
          edges.push({
            fromX: branch * 40 + 20,
            fromY: i * 60 + 30,
            toX: parentBranch * 40 + 20,
            toY: parentIndex * 60 + 30,
            branch: parentBranch,
          });
        }

        if (!commitToBranch.has(parentId)) {
          commitToBranch.set(parentId, parentBranch);
        }
      }
    }

    return { nodes, edges };
  }, [commits, branches]);

  const handleCommitClick = (commitId: string) => {
    if (selectedCommit && selectedCommit !== commitId) {
      onSelectDiff(selectedCommit, commitId);
    }
    setSelectedCommit(selectedCommit === commitId ? null : commitId);
  };

  const maxX = Math.max(...nodes.map((n) => n.x), 80) + 40;
  const maxY = Math.max(...nodes.map((n) => n.y), 100) + 60;

  const getCommitBranches = (commitId: string) => {
    return branches.filter((b) => b.commit_id === commitId);
  };

  if (commits.length === 0) {
    return (
      <div className="commit-graph">
        <div className="diff-header">
          <h2>Commit Graph</h2>
        </div>
        <div style={{ padding: '40px', textAlign: 'center', color: '#6c7086' }}>
          No commits yet
        </div>
      </div>
    );
  }

  return (
    <div className="commit-graph">
      <div className="diff-header">
        <h2>
          Commit Graph ({commits.length} commits)
          {selectedCommit && (
            <span style={{ marginLeft: 16, fontSize: 13, color: '#a6adc8' }}>
              Selected: {truncateHash(selectedCommit)} — click another commit to view diff
            </span>
          )}
        </h2>
      </div>
      <div className="commit-graph-inner">
        <div className="graph-lines" style={{ width: maxX, minHeight: maxY }}>
          <svg width={maxX} height={maxY} style={{ position: 'absolute', top: 0, left: 0 }}>
            {edges.map((edge, idx) => {
              const midY = (edge.fromY + edge.toY) / 2;
              const path =
                edge.fromX === edge.toX
                  ? `M ${edge.fromX} ${edge.fromY} L ${edge.toX} ${edge.toY}`
                  : `M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${midY}, ${edge.toX} ${midY}, ${edge.toX} ${edge.toY}`;
              return (
                <path
                  key={idx}
                  d={path}
                  fill="none"
                  stroke=""
                  strokeWidth={2}
                  className={`graph-path branch-${edge.branch % 6}`}
                />
              );
            })}
          </svg>
          {nodes.map((node) => (
            <div
              key={node.commit.id}
              className={`commit-dot ${node.commit.parents.length > 1 ? 'merge' : node.commit.parents.length === 0 ? 'initial' : ''}`}
              style={{
                position: 'absolute',
                left: node.x - 7,
                top: node.y - 7,
              }}
            />
          ))}
        </div>
        <div className="commit-list">
          {nodes.map((node) => {
            const commitBranches = getCommitBranches(node.commit.id);
            return (
              <div
                key={node.commit.id}
                className={`commit-item ${selectedCommit === node.commit.id ? 'selected' : ''}`}
                onClick={() => handleCommitClick(node.commit.id)}
              >
                <div className="commit-info">
                  <div className="commit-message">
                    {commitBranches.map((b) => (
                      <span key={b.name} className="commit-branch">
                        {b.name}
                      </span>
                    ))}
                    {node.commit.message}
                  </div>
                  <div className="commit-meta">
                    <span className="commit-hash">{truncateHash(node.commit.id)}</span>
                    <span>{node.commit.author}</span>
                    <span>{formatTimestamp(node.commit.timestamp)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
