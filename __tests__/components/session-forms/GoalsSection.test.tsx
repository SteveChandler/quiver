/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { GoalsSection } from '@/components/session-forms/GoalsSection';
import { SessionFormState } from '@/hooks/use-session-form';

// Mock the session form constants
jest.mock('@/lib/constants/session-form-constants', () => ({
  getFormText: jest.fn(),
  SKILL_GOALS: ['Pop-ups', 'Cutbacks', 'Duck Dives'],
  getRatingDescription: jest.fn(() => 'Test rating'),
}));

const mockUpdateField = jest.fn();

const defaultFormState = {
  selectedDate: '',
  selectedTime: '',
  selectedBeach: '',
  selectedBeachId: '',
  selectedBoard: '',
  boardId: '',
  notes: '',
  overallRating: '',
  waveQuality: '',
  crowdLevel: '',
  parkingEase: '',
  waterTemp: '',
  duration: '',
  photos: [],
  waveTypes: [],
} as SessionFormState;

describe('GoalsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with fallback when getFormText returns undefined', () => {
    const { getFormText } = require('@/lib/constants/session-form-constants');
    getFormText.mockReturnValue(undefined);

    render(
      <GoalsSection
        mode="plan"
        formState={defaultFormState}
        updateField={mockUpdateField}
      />
    );

    // Should show the default fallback text
    expect(screen.getByText('Session Goals')).toBeInTheDocument();
  });

  it('should render with fallback when getFormText returns null', () => {
    const { getFormText } = require('@/lib/constants/session-form-constants');
    getFormText.mockReturnValue(null);

    render(
      <GoalsSection
        mode="plan"
        formState={defaultFormState}
        updateField={mockUpdateField}
      />
    );

    // Should show the default fallback text
    expect(screen.getByText('Session Goals')).toBeInTheDocument();
  });

  it('should render with fallback when getFormText returns invalid data', () => {
    const { getFormText } = require('@/lib/constants/session-form-constants');
    getFormText.mockReturnValue('invalid string');

    render(
      <GoalsSection
        mode="plan"
        formState={defaultFormState}
        updateField={mockUpdateField}
      />
    );

    // Should show the default fallback text
    expect(screen.getByText('Session Goals')).toBeInTheDocument();
  });

  it('should render correctly when getFormText returns valid data', () => {
    const { getFormText } = require('@/lib/constants/session-form-constants');
    getFormText.mockReturnValue({
      goals: 'What are your goals?',
      showPerformanceRating: false,
    });

    render(
      <GoalsSection
        mode="plan"
        formState={defaultFormState}
        updateField={mockUpdateField}
      />
    );

    // Should show the proper text from getFormText
    expect(screen.getByText('What are your goals?')).toBeInTheDocument();
    expect(screen.getByText('Focus Areas')).toBeInTheDocument();
  });

  it('should render with fallback when mode is undefined', () => {
    const { getFormText } = require('@/lib/constants/session-form-constants');
    getFormText.mockReturnValue({
      goals: 'Test Goals',
      showPerformanceRating: false,
    });

    render(
      <GoalsSection
        mode={undefined as any}
        formState={defaultFormState}
        updateField={mockUpdateField}
      />
    );

    // Should still render without crashing
    expect(screen.getByText('Test Goals')).toBeInTheDocument();
  });

  it('should handle empty goals object gracefully', () => {
    const { getFormText } = require('@/lib/constants/session-form-constants');
    getFormText.mockReturnValue({});

    render(
      <GoalsSection
        mode="plan"
        formState={defaultFormState}
        updateField={mockUpdateField}
      />
    );

    // Should show loading fallback
    expect(screen.getByText('Loading goals section...')).toBeInTheDocument();
  });

  it('should render skill goals buttons', () => {
    const { getFormText } = require('@/lib/constants/session-form-constants');
    getFormText.mockReturnValue({
      goals: 'Test Goals',
      showPerformanceRating: false,
    });

    render(
      <GoalsSection
        mode="plan"
        formState={defaultFormState}
        updateField={mockUpdateField}
      />
    );

    // Should show skill goal buttons
    expect(screen.getByRole('button', { name: 'Pop-ups' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cutbacks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duck Dives' })).toBeInTheDocument();
  });

  it('should show performance rating for log mode', () => {
    const { getFormText } = require('@/lib/constants/session-form-constants');
    getFormText.mockReturnValue({
      goals: 'How did you perform?',
      showPerformanceRating: true,
    });

    render(
      <GoalsSection
        mode="log"
        formState={defaultFormState}
        updateField={mockUpdateField}
      />
    );

    // Should show performance rating section for log mode
    expect(screen.getByText('How did you perform?')).toBeInTheDocument();
    expect(screen.getByText('Overall Goal Performance')).toBeInTheDocument();
    expect(screen.getByText('Skills Practiced')).toBeInTheDocument();
  });
});