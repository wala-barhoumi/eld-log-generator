import React, { useRef, useEffect, useMemo } from 'react';
import './DailyLogViewer.css';

function DailyLogViewer({ logs }) {
  if (!logs || logs.length === 0) {
    return <div className="no-data">No daily logs available</div>;
  }

  return (
    <div className="daily-log-viewer">
      {logs.map((log, index) => (
        <DailyLogSheet key={index} log={log} />
      ))}
    </div>
  );
}

function DailyLogSheet({ log }) {
  const canvasRef = useRef(null);

  // ✅ Memoize logEntries to fix ESLint warning
  const logEntries = useMemo(() => log?.log_data || [], [log]);

  useEffect(() => {
    if (canvasRef.current && logEntries.length > 0) {
      drawLogGrid(canvasRef.current, log, logEntries);
    }
  }, [log, logEntries]);

  return (
    <div className="daily-log-sheet">
      <div className="log-header">
        <h3>📅 {new Date(log.date).toLocaleDateString()}</h3>
        <div className="log-totals">
          <span className="total-item">
            <span className="dot off-duty"></span>
            Off Duty: {(log.total_off_duty_hours || 0).toFixed(1)}h
          </span>
          <span className="total-item">
            <span className="dot sleeper"></span>
            Sleeper: {(log.total_sleeper_berth_hours || 0).toFixed(1)}h
          </span>
          <span className="total-item">
            <span className="dot driving"></span>
            Driving: {(log.total_driving_hours || 0).toFixed(1)}h
          </span>
          <span className="total-item">
            <span className="dot on-duty"></span>
            On Duty: {(log.total_on_duty_hours || 0).toFixed(1)}h
          </span>
        </div>
      </div>

      <canvas ref={canvasRef} width={1200} height={300} className="log-canvas" />

      {logEntries.length > 0 && (
        <div className="log-entries">
          <h4>Detailed Entries</h4>
          <table className="entries-table">
            <thead>
              <tr>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th>Location</th>
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {logEntries.map((entry, index) => (
                <tr key={index}>
                  <td>{formatTime(entry.start_time)}</td>
                  <td>{formatTime(entry.end_time)}</td>
                  <td>
                    <span className={`status-badge ${entry.status}`}>
                      {entry.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{entry.location}</td>
                  <td>{entry.activity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatTime(value) {
  // Handles both "HH:MM" strings and numeric hours like 7.5
  if (typeof value === 'string') {
    return value; // already formatted
  }

  if (typeof value === 'number') {
    const h = Math.floor(value);
    const m = Math.floor((value - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  return '--:--';
}

function timeToHours(timeValue) {
  // Handles both "HH:MM" strings and numeric values
  if (typeof timeValue === 'number') return timeValue;

  if (typeof timeValue === 'string' && timeValue.includes(':')) {
    const [hours, minutes] = timeValue.split(':').map(Number);
    return hours + minutes / 60;
  }

  return 0; // fallback
}

function drawLogGrid(canvas, log, logEntries) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const marginLeft = 120;
  const marginTop = 40;
  const gridWidth = canvas.width - marginLeft - 40;
  const gridHeight = 200;
  const hourWidth = gridWidth / 24;
  const rowHeight = gridHeight / 4;

  // Background
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(marginLeft, marginTop, gridWidth, gridHeight);

  // Vertical grid lines
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 24; i++) {
    const x = marginLeft + i * hourWidth;
    ctx.beginPath();
    ctx.moveTo(x, marginTop);
    ctx.lineTo(x, marginTop + gridHeight);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#333';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    const hour = i === 0 ? '12' : i <= 12 ? i : i - 12;
    const period = i < 12 ? 'AM' : 'PM';
    ctx.fillText(hour, x, marginTop - 15);
    if (i % 6 === 0) ctx.fillText(period, x, marginTop - 5);
  }

  // Horizontal lines and labels
  const statuses = ['Off Duty', 'Sleeper Berth', 'Driving', 'On Duty'];
  for (let i = 0; i <= 4; i++) {
    const y = marginTop + i * rowHeight;
    ctx.beginPath();
    ctx.moveTo(marginLeft, y);
    ctx.lineTo(marginLeft + gridWidth, y);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (i < 4) {
      ctx.fillStyle = '#333';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(statuses[i], marginLeft - 10, y + rowHeight / 2 + 4);
    }
  }

  // Draw activity bars
  const statusColors = {
    off_duty: '#4CAF50',
    sleeper_berth: '#2196F3',
    driving: '#FF9800',
    on_duty_not_driving: '#F44336'
  };

  const statusRows = {
    off_duty: 0,
    sleeper_berth: 1,
    driving: 2,
    on_duty_not_driving: 3
  };

  logEntries.forEach(entry => {
    if (!entry.start_time || !entry.end_time) return;

    const row = statusRows[entry.status] ?? 0;
    const color = statusColors[entry.status] ?? '#999';
    const startHour = timeToHours(entry.start_time);
    const endHour = timeToHours(entry.end_time);

    const y = marginTop + row * rowHeight + 5;
    const barHeight = rowHeight - 10;

    if (endHour < startHour) {
      // Spans midnight
      const x1 = marginLeft + startHour * hourWidth;
      drawBar(ctx, x1, y, (24 - startHour) * hourWidth, barHeight, color);
      drawBar(ctx, marginLeft, y, endHour * hourWidth, barHeight, color);
    } else {
      const x = marginLeft + startHour * hourWidth;
      const w = (endHour - startHour) * hourWidth;
      drawBar(ctx, x, y, w, barHeight, color);
    }
  });

  // Border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(marginLeft, marginTop, gridWidth, gridHeight);
}

function drawBar(ctx, x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
}

export default DailyLogViewer;
