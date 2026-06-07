import React, { useState, useEffect, useRef } from 'react';
import { BranchInfo } from '../types';

interface BranchSelectorProps {
  branches: BranchInfo[];
  currentBranch: string;
  onSwitch: (name: string) => void;
}

export default function BranchSelector({ branches, currentBranch, onSwitch }: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = currentBranch || '(no branch)';

  return (
    <div className="branch-selector" ref={dropdownRef}>
      <button
        className="branch-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="branch-icon">🌿</span>
        <span>{displayName}</span>
        <span style={{ marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="branch-dropdown">
          {branches.length === 0 ? (
            <div style={{ padding: '12px', color: '#6c7086', textAlign: 'center' }}>
              No branches yet
            </div>
          ) : (
            branches.map((branch) => (
              <div
                key={branch.name}
                className={`branch-dropdown-item ${branch.current ? 'current' : ''}`}
                onClick={() => {
                  if (!branch.current) {
                    onSwitch(branch.name);
                  }
                  setIsOpen(false);
                }}
              >
                <span>
                  <span className="branch-icon" style={{ marginRight: 8 }}>
                    {branch.current ? '✓' : '  '}
                  </span>
                  {branch.name}
                </span>
                <span style={{ fontSize: 11, color: '#6c7086', fontFamily: 'monospace' }}>
                  {branch.commit_id.slice(0, 7)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
