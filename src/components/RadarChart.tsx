import React, { useState } from 'react';
import { PRINCIPLES_DATA } from '../data';

interface RadarChartProps {
  scores: { [key: number]: number }; // principleId -> score (1.0 to 4.0)
  activeId?: number;
  onHoverPrinciple?: (id: number | null) => void;
  onSelectPrinciple?: (id: number) => void;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  scores,
  activeId,
  onHoverPrinciple,
  onSelectPrinciple,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // SVG parameters
  const width = 450;
  const height = 400;
  const cx = width / 2;
  const cy = height / 2 - 10;
  const r = 130;
  const totalAxes = 7;

  // Compute angles for 7 axes starting from the top (-90 deg), going clockwise
  const getCoordinates = (index: number, val: number) => {
    // 1 to 4 scaling
    const scale = val / 4;
    const currentRadius = r * scale;
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / totalAxes;
    return {
      x: cx + currentRadius * Math.cos(angle),
      y: cy + currentRadius * Math.sin(angle),
    };
  };

  // Coordinates for the grid lines (Level 1 to 4 reference heptagons)
  const gridLevels = [1, 2, 3, 4];
  const gridPolygons = gridLevels.map((level) => {
    return Array.from({ length: totalAxes }).map((_, i) => getCoordinates(i, level));
  });

  // Coordinates for user data values
  const userPoints = PRINCIPLES_DATA.map((p, i) => {
    const score = scores[p.id] || 1;
    return getCoordinates(i, score);
  });

  const getPointsString = (points: { x: number; y: number }[]) => {
    return points.map((p) => `${p.x},${p.y}`).join(' ');
  };

  // Brief titles for radar labels to prevent overflow
  const shortLabels: { [key: number]: string } = {
    1: "ליבת מיומנויות",
    2: "למידה אנושית",
    3: "תשתית AI",
    4: "מודל BYOD",
    5: "חינוך הוליסטי",
    6: "מרחבי למידה",
    7: "תרבות מייקרס",
  };

  return (
    <div className="flex flex-col items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden w-full max-w-[480px] mx-auto">
      <div className="text-center mb-4">
        <h4 className="font-semibold text-lg text-slate-900">מפת העכביש הבית-ספרית</h4>
        <p className="text-xs text-slate-500">תמונת מצב חזותית בזמן אמת של 7 העקרונות</p>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none overflow-visible"
        style={{ direction: 'ltr' }} // keep math coordinate system absolute
      >
        {/* Definition for glows and gradients */}
        <defs>
          <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="userGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Outer radial ambient glow background */}
        <circle cx={cx} cy={cy} r={r} fill="url(#radarGlow)" />

        {/* Grid Polygons for Levels 1, 2, 3, 4 */}
        {gridPolygons.map((points, levelIdx) => {
          const scoreLevel = gridLevels[levelIdx];
          return (
            <g key={scoreLevel} className="group">
              <polygon
                points={getPointsString(points)}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray={scoreLevel === 4 ? 'none' : '4 3'}
              />
              {/* Level Labels on the vertical top axis */}
              <text
                x={cx}
                y={cy - (r * scoreLevel) / 4 + 4}
                className="text-xs font-mono fill-slate-400 font-medium select-none"
                textAnchor="middle"
              >
                {scoreLevel}
              </text>
            </g>
          );
        })}

        {/* Spoke Axes Lines */}
        {PRINCIPLES_DATA.map((p, i) => {
          const outerPt = getCoordinates(i, 4);
          return (
            <line
              key={p.id}
              x1={cx}
              y1={cy}
              x2={outerPt.x}
              y2={outerPt.y}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          );
        })}

        {/* User Filled Area Heptagon */}
        <polygon
          points={getPointsString(userPoints)}
          fill="url(#userGrad)"
          stroke="#4f46e5"
          strokeWidth="2.5"
          className="transition-all duration-300 ease-out"
        />

        {/* Text Labels at the outer vertices */}
        {PRINCIPLES_DATA.map((p, i) => {
          const outerPt = getCoordinates(i, 4);
          const labelDist = 24; // offset label slightly outside the tip
          const angle = -Math.PI / 2 + (2 * Math.PI * i) / totalAxes;
          const lx = cx + (r + labelDist) * Math.cos(angle);
          const ly = cy + (r + labelDist) * Math.sin(angle) + 4;

          const isHovered = hoveredPoint === p.id || activeId === p.id;
          const score = scores[p.id] || 1;

          return (
            <g
              key={p.id}
              className="cursor-pointer"
              onMouseEnter={() => {
                setHoveredPoint(p.id);
                if (onHoverPrinciple) onHoverPrinciple(p.id);
              }}
              onMouseLeave={() => {
                setHoveredPoint(null);
                if (onHoverPrinciple) onHoverPrinciple(null);
              }}
              onClick={() => {
                if (onSelectPrinciple) onSelectPrinciple(p.id);
              }}
            >
              {/* Label Circle Backdrop on Hover */}
              {isHovered && (
                <circle
                  cx={lx}
                  cy={ly - 4}
                  r="24"
                  fill={p.accentColor}
                  className="opacity-15 transition-all duration-200"
                />
              )}

              {/* Icon / Indicator or text */}
              <text
                x={lx}
                y={ly - 6}
                textAnchor="middle"
                className={`text-[12px] font-semibold transition-all duration-200 select-none ${
                  isHovered ? 'fill-slate-900 scale-105' : 'fill-slate-600'
                }`}
                style={{ direction: 'rtl' }}
              >
                {shortLabels[p.id]}
              </text>
              <text
                x={lx}
                y={ly + 6}
                textAnchor="middle"
                className="text-xs font-mono font-bold select-none"
                fill={p.accentColor}
              >
                רמה {score.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Interactive Vertex Dots */}
        {userPoints.map((pt, i) => {
          const p = PRINCIPLES_DATA[i];
          const isSelected = hoveredPoint === p.id || activeId === p.id;
          const score = scores[p.id] || 1;

          return (
            <g key={p.id}>
              {/* Highlight Halo */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isSelected ? 10 : 6}
                fill={p.accentColor}
                className="opacity-30 transition-all duration-200 cursor-help"
              />
              {/* Inner Dot */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={4}
                fill="#ffffff"
                stroke={p.accentColor}
                strokeWidth="2.5"
                onMouseEnter={() => {
                  setHoveredPoint(p.id);
                  if (onHoverPrinciple) onHoverPrinciple(p.id);
                }}
                onMouseLeave={() => {
                  setHoveredPoint(null);
                  if (onHoverPrinciple) onHoverPrinciple(null);
                }}
                className="cursor-pointer"
              />
            </g>
          );
        })}
      </svg>

      {/* Micro Legend & Interactive stats */}
      <div className="grid grid-cols-4 gap-2 border-t border-slate-200 pt-4 mt-2 w-full text-center">
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-slate-400">רמה 1</span>
          <span className="text-xs text-slate-500 font-medium">ניצוצות</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-slate-400">רמה 2</span>
          <span className="text-xs text-slate-500 font-medium">חדשנות</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-slate-400">רמה 3</span>
          <span className="text-xs text-slate-500 font-medium">בשגרה</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-indigo-500">רמה 4</span>
          <span className="text-xs text-indigo-600 font-bold">חלוציות</span>
        </div>
      </div>
    </div>
  );
};
