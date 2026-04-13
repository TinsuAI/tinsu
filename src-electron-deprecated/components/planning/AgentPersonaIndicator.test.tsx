import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentPersonaIndicator } from './AgentPersonaIndicator'

describe('AgentPersonaIndicator', () => {
  describe('idle state', () => {
    it('renders "No agent active" when isRunning is false', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:pm"
          workflowKey="prd"
          isRunning={false}
        />
      )

      expect(screen.getByText('No agent active')).toBeInTheDocument()
      expect(screen.getByTestId('agent-persona-indicator')).toBeInTheDocument()
    })

    it('renders "No agent active" when agentName is null', () => {
      render(
        <AgentPersonaIndicator
          agentName={null}
          workflowKey="prd"
          isRunning={true}
        />
      )

      expect(screen.getByText('No agent active')).toBeInTheDocument()
    })

    it('renders "No agent active" when both isRunning false and agentName null', () => {
      render(
        <AgentPersonaIndicator
          agentName={null}
          workflowKey={null}
          isRunning={false}
        />
      )

      expect(screen.getByText('No agent active')).toBeInTheDocument()
    })
  })

  describe('known personas', () => {
    it('renders PM persona with green color when running', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:pm"
          workflowKey="prd"
          isRunning={true}
        />
      )

      expect(screen.getByText('PM')).toBeInTheDocument()
      const indicator = screen.getByTestId('agent-persona-indicator')
      expect(indicator).toHaveClass('text-green-400')
    })

    it('renders Architect persona with orange color when running', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:architect"
          workflowKey="architecture"
          isRunning={true}
        />
      )

      expect(screen.getByText('Architect')).toBeInTheDocument()
      const indicator = screen.getByTestId('agent-persona-indicator')
      expect(indicator).toHaveClass('text-orange-400')
    })

    it('renders UX Designer persona with purple color when running', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:ux-designer"
          workflowKey="ux-design"
          isRunning={true}
        />
      )

      expect(screen.getByText('UX Designer')).toBeInTheDocument()
      const indicator = screen.getByTestId('agent-persona-indicator')
      expect(indicator).toHaveClass('text-purple-400')
    })

    it('renders Analyst persona with blue color when running', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:analyst"
          workflowKey="domain-research"
          isRunning={true}
        />
      )

      expect(screen.getByText('Analyst')).toBeInTheDocument()
      const indicator = screen.getByTestId('agent-persona-indicator')
      expect(indicator).toHaveClass('text-blue-400')
    })
  })

  describe('workflow name display', () => {
    it('renders workflow name from BMAD_WORKFLOWS mapping', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:pm"
          workflowKey="prd"
          isRunning={true}
        />
      )

      expect(screen.getByText('Create PRD')).toBeInTheDocument()
    })

    it('renders Product Brief workflow name', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:pm"
          workflowKey="product-brief"
          isRunning={true}
        />
      )

      expect(screen.getByText('Product Brief')).toBeInTheDocument()
    })

    it('renders raw workflowKey when no BMAD_WORKFLOWS match', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:pm"
          workflowKey="custom-workflow"
          isRunning={true}
        />
      )

      expect(screen.getByText('custom-workflow')).toBeInTheDocument()
    })
  })

  describe('animated pulse dot', () => {
    it('renders animated pulse dot when running with known agent', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:pm"
          workflowKey="prd"
          isRunning={true}
        />
      )

      const indicator = screen.getByTestId('agent-persona-indicator')
      const pulseElement = indicator.querySelector('.animate-pulse')
      expect(pulseElement).toBeInTheDocument()
    })

    it('renders pulse dot with persona-specific color', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:architect"
          workflowKey="architecture"
          isRunning={true}
        />
      )

      const indicator = screen.getByTestId('agent-persona-indicator')
      const pulseElement = indicator.querySelector('.animate-pulse')
      expect(pulseElement).toHaveClass('bg-orange-400')
    })

    it('does not render pulse dot when not running', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:pm"
          workflowKey="prd"
          isRunning={false}
        />
      )

      const indicator = screen.getByTestId('agent-persona-indicator')
      const pulseElement = indicator.querySelector('.animate-pulse')
      expect(pulseElement).not.toBeInTheDocument()
    })
  })

  describe('unknown agent fallback', () => {
    it('falls back to raw agent name segment for unknown agents', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:dev"
          workflowKey="prd"
          isRunning={true}
        />
      )

      expect(screen.getByText('dev')).toBeInTheDocument()
    })

    it('renders unknown agent with zinc/muted color', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:unknown-persona"
          workflowKey="prd"
          isRunning={true}
        />
      )

      expect(screen.getByText('unknown-persona')).toBeInTheDocument()
      const indicator = screen.getByTestId('agent-persona-indicator')
      expect(indicator).toHaveClass('text-zinc-400')
    })

    it('renders unknown agent with pulse dot', () => {
      render(
        <AgentPersonaIndicator
          agentName="bmad:bmm:agents:custom"
          workflowKey="prd"
          isRunning={true}
        />
      )

      const indicator = screen.getByTestId('agent-persona-indicator')
      const pulseElement = indicator.querySelector('.animate-pulse')
      expect(pulseElement).toBeInTheDocument()
    })

    it('renders agent name without colons as-is', () => {
      render(
        <AgentPersonaIndicator
          agentName="simple-agent"
          workflowKey="prd"
          isRunning={true}
        />
      )

      expect(screen.getByText('simple-agent')).toBeInTheDocument()
    })
  })

  describe('data-testid', () => {
    it('has data-testid="agent-persona-indicator" in all states', () => {
      const { rerender } = render(
        <AgentPersonaIndicator agentName={null} workflowKey={null} isRunning={false} />
      )
      expect(screen.getByTestId('agent-persona-indicator')).toBeInTheDocument()

      rerender(
        <AgentPersonaIndicator agentName="bmad:bmm:agents:pm" workflowKey="prd" isRunning={true} />
      )
      expect(screen.getByTestId('agent-persona-indicator')).toBeInTheDocument()
    })
  })
})
