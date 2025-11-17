import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('Button Component', () => {
  it('should render button with children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('should apply variant classes', () => {
    const { container } = render(<Button variant="destructive">Destructive</Button>)
    expect(container.firstChild).toHaveClass('bg-destructive')
  })

  it('should apply size classes', () => {
    const { container } = render(<Button size="lg">Large</Button>)
    expect(container.firstChild).toHaveClass('h-11')
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={handleClick}>Clickable</Button>)
    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should not call onClick when disabled', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={handleClick} disabled>Not Clickable</Button>)
    await user.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })
})
