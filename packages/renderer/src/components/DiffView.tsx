import React, { useState, useCallback } from 'react';
import { DiffEntry } from '../types';
import { computeLineDiff, LineDiff } from '../utils/diff';
import { formatFileSize } from '../utils/buffer';

const LARGE_DIFF_THRESHOLD = 1024 * 1024;
const VERY_LARGE_DIFF_THRESHOLD = 50 * 1024 * 1024;

interface DiffViewProps {
  entries: DiffEntry[];
  title: string;
}

function getContentSize(entry: DiffEntry): number {
  const oldSize = (entry.old_content || '').length;
  const newSize = (entry.new_content || '').length;
  return oldSize + newSize;
}

function DiffFileView({ entry }: { entry: DiffEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [lines, setLines] = useState<LineDiff[]>([]);
  const [computing, setComputing] = useState(false);

  const contentSize = getContentSize(entry);
  const isLarge = contentSize > LARGE_DIFF_THRESHOLD;
  const isVeryLarge = contentSize > VERY_LARGE_DIFF_THRESHOLD;

  const computeDiff = useCallback(() => {
    if (computing) return;
    setComputing(true);
    
    setTimeout(() => {
      const oldContent = entry.old_content || '';
      const newContent = entry.new_content || '';
      if (entry.status === 'modified') {
        const computed = computeLineDiff(oldContent, newContent);
        setLines(computed);
      }
      setComputing(false);
    }, 50);
  }, [entry, computing]);

  const handleExpand = useCallback(() => {
    const willExpand = !expanded;
    setExpanded(willExpand);
    
    if (willExpand && entry.status === 'modified' && lines.length === 0 && !isVeryLarge) {
      computeDiff();
    }
  }, [expanded, entry.status, lines.length, isVeryLarge, computeDiff]);

  const statusLabel = {
    added: '+ Added',
    deleted: '- Deleted',
    modified: '~ Modified',
  }[entry.status] || entry.status;

  const statusClass = `status-${entry.status}`;

  const sizeLabel = isLarge ? ` (${formatFileSize(contentSize)})` : '';
  const warningLabel = isVeryLarge ? ' ⚠️ Very large - diff disabled' : isLarge ? ' ⚠️ Large file' : '';

  const renderContentLines = (content: string, isAdded: boolean) => {
    const contentLines = content.split('\n');
    if (isVeryLarge && contentLines.length > 1000) {
      return (
        <div className="diff-large-warning">
          <p>File is too large to display ({formatFileSize(content.length)}).</p>
          <p>Showing first 1000 lines only:</p>
          {contentLines.slice(0, 1000).map((line, idx) => (
            <div key={idx} className={`diff-line ${isAdded ? 'added' : 'removed'}`}>
              <span className="diff-line-num">{isAdded ? '' : idx + 1}</span>
              <span className="diff-line-sign">{isAdded ? '+' : '-'}</span>
              <span className="diff-line-content">{line || ' '}</span>
            </div>
          ))}
          <div className="diff-truncated">... ({contentLines.length - 1000} more lines truncated)</div>
        </div>
      );
    }
    return contentLines.map((line, idx) => (
      <div key={idx} className={`diff-line ${isAdded ? 'added' : 'removed'}`}>
        <span className="diff-line-num">{isAdded ? '' : idx + 1}</span>
        <span className="diff-line-sign">{isAdded ? '+' : '-'}</span>
        <span className="diff-line-content">{line || ' '}</span>
      </div>
    ));
  };

  if (entry.status === 'added') {
    const content = entry.new_content || '';
    return (
      <div className="diff-file">
        <div className="diff-file-header" onClick={handleExpand}>
          <span className="diff-file-name">
            <span className={`tree-status ${statusClass}`}>{statusLabel}</span>
            {'  '}
            {entry.path}
            <span className="diff-size-label">{sizeLabel}{warningLabel}</span>
          </span>
          <span>{expanded ? '▼' : '▶'}</span>
        </div>
        {expanded && (
          <div className="diff-file-content">
            {renderContentLines(content, true)}
          </div>
        )}
      </div>
    );
  }

  if (entry.status === 'deleted') {
    const content = entry.old_content || '';
    return (
      <div className="diff-file">
        <div className="diff-file-header" onClick={handleExpand}>
          <span className="diff-file-name">
            <span className={`tree-status ${statusClass}`}>{statusLabel}</span>
            {'  '}
            {entry.path}
            <span className="diff-size-label">{sizeLabel}{warningLabel}</span>
          </span>
          <span>{expanded ? '▼' : '▶'}</span>
        </div>
        {expanded && (
          <div className="diff-file-content">
            {renderContentLines(content, false)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="diff-file">
      <div className="diff-file-header" onClick={handleExpand}>
        <span className="diff-file-name">
          <span className={`tree-status ${statusClass}`}>{statusLabel}</span>
          {'  '}
          {entry.path}
          <span className="diff-size-label">{sizeLabel}{warningLabel}</span>
        </span>
        <span>{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="diff-file-content">
          {isVeryLarge ? (
            <div className="diff-large-warning">
              <p>File is too large to compute line-by-line diff ({formatFileSize(contentSize)}).</p>
              <p>Showing full old and new content side by side would be too slow.</p>
              <button className="diff-force-btn" onClick={(e) => { e.stopPropagation(); computeDiff(); }}>
                Compute diff anyway (may be slow)
              </button>
            </div>
          ) : computing ? (
            <div className="diff-computing">Computing diff...</div>
          ) : lines.length > 0 ? (
            lines.map((line, idx) => (
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
            ))
          ) : (
            <div style={{ padding: '10px', color: '#6c7086' }}>
              <button className="diff-force-btn" onClick={(e) => { e.stopPropagation(); computeDiff(); }}>
                Click to compute diff
              </button>
            </div>
          )}
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
