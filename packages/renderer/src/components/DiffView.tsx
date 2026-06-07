import React, { useState } from 'react';
import { DiffEntry } from '../types';
import { computeLineDiff, LineDiff } from '../utils/diff';

interface DiffViewProps {
  entries: DiffEntry[];
  title: string;
}

function DiffFileView({ entry }: { entry: DiffEntry }) {
  const [expanded, setExpanded] = useState(true);
  const [lines, setLines] = useState<LineDiff[]>([]);

  React.useEffect(() => {
    const oldContent = entry.old_content || '';
    const newContent = entry.new_content || '';
    if (entry.status === 'modified') {
      setLines(computeLineDiff(oldContent, newContent));
    }
  }, [entry]);

  const statusLabel = {
    added: '+ Added',
    deleted: '- Deleted',
    modified: '~ Modified',
  }[entry.status] || entry.status;

  const statusClass = `status-${entry.status}`;

  if (entry.status === 'added') {
    const contentLines = (entry.new_content || '').split('\n');
    return (
      <div className="diff-file">
        <div className="diff-file-header" onClick={() => setExpanded(!expanded)}>
          <span className="diff-file-name">
            <span className={`tree-status ${statusClass}`}>{statusLabel}</span>
            {'  '}
            {entry.path}
          </span>
          <span>{expanded ? '▼' : '▶'}</span>
        </div>
        {expanded && (
          <div className="diff-file-content">
            {contentLines.map((line, idx) => (
              <div key={idx} className="diff-line added">
                <span className="diff-line-num"></span>
                <span className="diff-line-sign">+</span>
                <span className="diff-line-content">{line || ' '}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (entry.status === 'deleted') {
    const contentLines = (entry.old_content || '').split('\n');
    return (
      <div className="diff-file">
        <div className="diff-file-header" onClick={() => setExpanded(!expanded)}>
          <span className="diff-file-name">
            <span className={`tree-status ${statusClass}`}>{statusLabel}</span>
            {'  '}
            {entry.path}
          </span>
          <span>{expanded ? '▼' : '▶'}</span>
        </div>
        {expanded && (
          <div className="diff-file-content">
            {contentLines.map((line, idx) => (
              <div key={idx} className="diff-line removed">
                <span className="diff-line-num">{idx + 1}</span>
                <span className="diff-line-sign">-</span>
                <span className="diff-line-content">{line || ' '}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="diff-file">
      <div className="diff-file-header" onClick={() => setExpanded(!expanded)}>
        <span className="diff-file-name">
          <span className={`tree-status ${statusClass}`}>{statusLabel}</span>
          {'  '}
          {entry.path}
        </span>
        <span>{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="diff-file-content">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className={`diff-line ${line.type === 'added' ? 'added' : line.type === 'removed' ? 'removed' : ''}`}
            >
              <span className="diff-line-num">
                {line.oldLineNum || ''}
              </span>
              <span className="diff-line-sign">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <span className="diff-line-content">{line.content || ' '}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DiffView({ entries, title }: DiffViewProps) {
  if (entries.length === 0) {
    return (
      <div className="diff-view">
        <div className="diff-header">
          <h2>{title}</h2>
        </div>
        <div style={{ padding: '40px', textAlign: 'center', color: '#6c7086' }}>
          No changes to display
        </div>
      </div>
    );
  }

  return (
    <div className="diff-view">
      <div className="diff-header">
        <h2>
          {title} ({entries.length} {entries.length === 1 ? 'file' : 'files'})
        </h2>
      </div>
      {entries.map((entry, idx) => (
        <DiffFileView key={`${entry.path}-${idx}`} entry={entry} />
      ))}
    </div>
  );
}
