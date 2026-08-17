// __mocks__/TextMock.js
// Simple pass-through mock for the custom themed Text component
import React from 'react';
import { Text } from 'react-native';
export default function TextMock({ children, ...props }) {
  return <Text {...props}>{children}</Text>;
}
