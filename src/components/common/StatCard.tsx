/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: {
    value: string;
    positiveIsGood?: boolean;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  hint?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  trend,
  icon,
  hint,
}) => {
  return (
    <div className="bg-white border border-gray-200/80 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between text-gray-500 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</span>
        {icon && <span className="text-[#01B8AA]">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-[#374151] tabular-nums">
          {value}
        </span>
        {subValue && (
          <span className="text-xs text-gray-500 font-medium tabular-nums">
            {subValue}
          </span>
        )}
      </div>
      {(trend || hint) && (
        <div className="mt-2.5 flex items-center gap-2 text-xs text-gray-500">
          {trend && (
            <span
              className={`font-semibold tabular-nums ${
                trend.isPositive
                  ? trend.positiveIsGood
                    ? 'text-[#10B981]'
                    : 'text-[#EF4444]'
                  : trend.positiveIsGood
                  ? 'text-[#EF4444]'
                  : 'text-[#10B981]'
              }`}
            >
              {trend.value}
            </span>
          )}
          {hint && <span className="truncate">{hint}</span>}
        </div>
      )}
    </div>
  );
};
