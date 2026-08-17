/**
 * __tests__/screens/RecordScreen.test.js
 * Tests for the main recording UI.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import RecordScreen from '../../src/screens/RecordScreen';

// We mock the contexts so the component can render without wrappers
jest.mock('../../src/theme/ThemeContext', () => ({
  useTheme: () => ({ theme: { background: '#fff', text: '#000', surface: '#eee' } }),
}));
jest.mock('../../src/theme/AlertContext', () => ({
  useAlert: () => jest.fn(),
}));

describe('RecordScreen', () => {
  it('renders correctly', () => {
    // Basic render test to ensure the UI mounts without crashing
    const { getByText } = render(<RecordScreen navigation={{}} />);
    
    // Check for some static text that should always be there when idle
    expect(getByText(/00:00\.00/i)).toBeTruthy();
  });
});
