import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CommitInfo } from '../types';

interface TimeTravelSliderProps {
  commits: CommitInfo[];
  onTimeTravel: (commit: CommitInfo | null) => void;
  isTimeTraveling: boolean;
  onExitTimeTravel: () => void;
}

export const TimeTravelSlider: React.FC<TimeTravelSliderProps> = ({
  commits,
  onTimeTravel,
  isTimeTraveling,
  onExitTimeTravel,
}) => {
  const [currentIndex, setCurrentIndex] = useState(commits.length - 1);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCommit, setHoveredCommit] = useState<CommitInfo | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatDateShort = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    setCurrentIndex(index);
    if (commits[index] && !isDragging) {
      onTimeTravel(commits[index]);
    }
  }, [commits, onTimeTravel, isDragging]);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (commits[currentIndex]) {
      onTimeTravel(commits[currentIndex]);
    }
  }, [commits, currentIndex, onTimeTravel]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (commits[currentIndex]) {
          onTimeTravel(commits[currentIndex]);
        }
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, commits, currentIndex, onTimeTravel]);

  useEffect(() => {
    setCurrentIndex(commits.length - 1);
  }, [commits]);

  if (commits.length === 0) {
    return null;
  }

  const currentCommit = commits[currentIndex];

  return (
    <div className="time-travel-container">
      <div className="time-travel-header">
      <h3 className="time-travel-title">
        <span className="time-travel-icon">⏰</span>
        时间旅行
      </h3>
      {isTimeTraveling && (
        <button
          className="exit-time-travel"
          onClick={onExitTimeTravel}
        >
          退出时间旅行
        </button>
      )}
    </div>

    <div className="time-travel-slider-container" ref={sliderRef}>
      <div className="time-travel-marks">
        {commits.map((commit, index) => (
          <div
            key={commit.id}
            className={`time-travel-mark ${index <= currentIndex ? 'active' : ''}`}
            onMouseEnter={() => setHoveredCommit(commit)}
            onMouseLeave={() => setHoveredCommit(null)}
          >
            <div className="time-travel-dot" />
            {hoveredCommit?.id === commit.id && (
              <div className="time-travel-tooltip">
                <div className="tooltip-message">{commit.message}</div>
                <div className="tooltip-author">{commit.author}</div>
                <div className="tooltip-date">{formatDate(commit.timestamp)}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <input
        type="range"
        min="0"
        max={commits.length - 1}
        value={currentIndex}
        onChange={handleSliderChange}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className="time-travel-slider"
        disabled={commits.length <= 1}
      />

      <div className="time-travel-labels">
        <span className="time-travel-label">最早</span>
        <span className="time-travel-label">现在</span>
      </div>
    </div>

    {currentCommit && (
      <div className={`time-travel-commit-info ${isTimeTraveling ? 'time-traveling' : ''}`}>
      <div className="commit-info-header">
        <span className="commit-info-message">{currentCommit.message}</span>
        {currentCommit.is_signed && (
          <span className="commit-signature-badge">
            ✅ 已签名
          </span>
        )}
      </div>
      <div className="commit-info-meta">
        <span className="commit-info-author">
          作者: {currentCommit.author}
        </span>
        <span className="commit-info-time">
          {formatDate(currentCommit.timestamp)}
        </span>
      </div>
      <div className="commit-info-id">
        ID: {currentCommit.id.slice(0, 8)}...
      </div>
      {isTimeTraveling && (
        <div className="time-travel-warning">
          ⚠️ 当前处于时间旅行模式，修改文件不会被暂存或提交
        </div>
      )}
    </div>
  )}
  </div>
  );
};
