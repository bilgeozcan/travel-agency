import React from 'react';
import './HeaderGroup.css';

export interface HeaderGroupProps {
  overline?: string;
  title: string;
  subtitle?: string;
  className?: string;
}

export const HeaderGroup: React.FC<HeaderGroupProps> = ({
  overline,
  title,
  subtitle,
  className = '',
}) => {
  return (
    <div className={`header-group ${className}`.trim()}>
      {overline && <span className="text-overline header-group-overline">{overline}</span>}
      <h2 className="text-title header-group-title">{title}</h2>
      {subtitle && <p className="text-subtitle header-group-subtitle">{subtitle}</p>}
    </div>
  );
};
