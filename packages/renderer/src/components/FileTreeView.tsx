import React, { useState } from 'react';
import { TreeNode, FileStatus } from '../types';

interface FileTreeViewProps {
  tree: TreeNode;
  onAddFile: (filePath: string) => void;
  status: FileStatus[];
}

function getFileStatus(path: string, status: FileStatus[]): FileStatus | undefined {
  return status.find((s) => s.path === path);
}

function TreeNodeComponent({
  node,
  level = 0,
  onAddFile,
  status,
}: {
  node: TreeNode;
  level?: number;
  onAddFile: (filePath: string) => void;
  status: FileStatus[];
}) {
  const [expanded, setExpanded] = useState(true);
  const fileStatus = node.path ? getFileStatus(node.path, status) : undefined;

  const toggleExpand = () => {
    if (node.is_dir) {
      setExpanded(!expanded);
    }
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.path) {
      onAddFile(node.path);
    }
  };

  return (
    <div className="tree-node">
      <div className="tree-node-content" onClick={toggleExpand}>
        <span className="tree-icon">
          {node.is_dir ? (expanded ? '▼' : '▶') : '📄'}
        </span>
        <span className="tree-name">
          {node.name || '(root)'}
        </span>
        {fileStatus && (
          <span className={`tree-status status-${fileStatus.status}`}>
            {fileStatus.status}
          </span>
        )}
        {!node.is_dir && node.path && (
          <button className="add-btn" onClick={handleAdd}>
            + Stage
          </button>
        )}
      </div>
      {node.is_dir && expanded && node.children && (
        <div className="tree-children">
          {node.children.map((child, index) => (
            <TreeNodeComponent
              key={`${child.path}-${index}`}
              node={child}
              level={level + 1}
              onAddFile={onAddFile}
              status={status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTreeView({ tree, onAddFile, status }: FileTreeViewProps) {
  return (
    <div className="file-tree">
      <TreeNodeComponent node={tree} onAddFile={onAddFile} status={status} />
    </div>
  );
}
