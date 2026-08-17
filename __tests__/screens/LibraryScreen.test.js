/**
 * __tests__/screens/LibraryScreen.test.js
 * Tests for the Library UI.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import LibraryScreen from '../../src/screens/LibraryScreen';

// Mock contexts
jest.mock('../../src/theme/ThemeContext', () => ({
  useTheme: () => ({ theme: { background: '#fff', text: '#000', surface: '#eee', primary: '#333' } }),
}));
jest.mock('../../src/theme/AlertContext', () => ({
  useAlert: () => jest.fn(),
}));

describe('LibraryScreen', () => {
  it('renders correctly', () => {
    const { getByText } = render(<LibraryScreen navigation={{}} />);
    
    // Check for the main header text
    expect(getByText('Library')).toBeTruthy();
  });
});
