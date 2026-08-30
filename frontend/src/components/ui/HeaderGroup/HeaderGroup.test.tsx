import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeaderGroup } from './HeaderGroup';

describe('HeaderGroup', () => {
  it('renders title correctly', () => {
    render(<HeaderGroup title="Account Registration" />);
    expect(screen.getByText('Account Registration')).toBeInTheDocument();
  });

  it('renders overline when provided', () => {
    render(<HeaderGroup overline="START FOR FREE" title="Create account" />);
    expect(screen.getByText('START FOR FREE')).toBeInTheDocument();
    expect(screen.getByText('Create account')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <HeaderGroup 
        title="Welcome back" 
        subtitle="Please enter your email and password" 
      />
    );
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByText('Please enter your email and password')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(<HeaderGroup title="Test Title" className="custom-header" />);
    expect(container.firstChild).toHaveClass('header-group');
    expect(container.firstChild).toHaveClass('custom-header');
  });
});
