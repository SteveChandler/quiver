/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoalsSection } from '@/components/session-forms/GoalsSection';
import { SessionFormState } from '@/hooks/use-session-form';

// Mock the session form constants
jest.mock('@/lib/constants/session-form-constants', () => ({
  getFormText: jest.fn(),
  SKILL_GOALS: ['Pop-ups', 'Cutbacks', 'Duck Dives'],
  getRatingDescription: jest.fn(() => 'Test rating'),
}));

const mockUpdateField = jest.fn();

const defaultFormState: SessionFormState = {
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
  selectedGoals: [],
  skillRatings: {},
};

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

  describe('selectedGoals behavior', () => {
    function setup(overrides: Partial<SessionFormState> = {}) {
      const { getFormText } = require('@/lib/constants/session-form-constants');
      getFormText.mockReturnValue({ goals: 'Goals', showPerformanceRating: false });
      const formState = { ...defaultFormState, ...overrides };
      render(
        <GoalsSection mode="log" formState={formState} updateField={mockUpdateField} />
      );
    }

    it('goal toggle writes to selectedGoals, not notes', async () => {
      const user = userEvent.setup();
      setup({ selectedGoals: [] });

      await user.click(screen.getByRole('button', { name: 'Pop-ups' }));

      expect(mockUpdateField).toHaveBeenCalledWith('selectedGoals', ['Pop-ups']);
      expect(mockUpdateField).not.toHaveBeenCalledWith('notes', expect.anything());
    });

    it('initial render shows no skills selected', () => {
      setup({ selectedGoals: [] });

      const btn = screen.getByRole('button', { name: 'Pop-ups' });
      // outline variant — not the filled "default" variant
      expect(btn).not.toHaveClass('bg-primary');
    });

    it('inline rating row appears when skill goal is selected', () => {
      setup({ selectedGoals: ['Pop-ups'], skillRatings: {} });

      // The aria-labelled star button proves the rating row is rendered
      expect(screen.getByLabelText('Rate Pop-ups 1 stars')).toBeInTheDocument();
      expect(screen.getByLabelText('Rate Pop-ups 5 stars')).toBeInTheDocument();
    });

    it('rating row hides when skill is deselected', () => {
      setup({ selectedGoals: [], skillRatings: {} });

      // No rating stars should be rendered for Pop-ups when not selected
      expect(screen.queryByLabelText('Rate Pop-ups 1 stars')).not.toBeInTheDocument();
    });

    it('skillRatings state updated when user taps a star', async () => {
      const user = userEvent.setup();
      setup({ selectedGoals: ['Cutbacks'], skillRatings: {} });

      await user.click(screen.getByLabelText('Rate Cutbacks 4 stars'));

      expect(mockUpdateField).toHaveBeenCalledWith('skillRatings', { Cutbacks: 4 });
    });

    it('skill can be selected without a rating', async () => {
      const user = userEvent.setup();
      setup({ selectedGoals: [] });

      await user.click(screen.getByRole('button', { name: 'Duck Dives' }));

      expect(mockUpdateField).toHaveBeenCalledWith('selectedGoals', ['Duck Dives']);
      // No skillRatings call expected
      const skillRatingsCalls = mockUpdateField.mock.calls.filter(
        ([field]) => field === 'skillRatings'
      );
      expect(skillRatingsCalls).toHaveLength(0);
    });

    it('skill ratings section hidden in plan mode', () => {
      const { getFormText } = require('@/lib/constants/session-form-constants');
      getFormText.mockReturnValue({ goals: 'Goals', showPerformanceRating: false });
      render(
        <GoalsSection
          mode="plan"
          formState={{ ...defaultFormState, selectedGoals: ['Pop-ups'], skillRatings: {} }}
          updateField={mockUpdateField}
        />
      );

      expect(screen.queryByLabelText('Rate Pop-ups 1 stars')).not.toBeInTheDocument();
    });

    it('goal deselect removes from selectedGoals array', async () => {
      const user = userEvent.setup();
      setup({ selectedGoals: ['Pop-ups', 'Cutbacks'] });

      await user.click(screen.getByRole('button', { name: 'Pop-ups' }));

      expect(mockUpdateField).toHaveBeenCalledWith('selectedGoals', ['Cutbacks']);
    });
  });
});