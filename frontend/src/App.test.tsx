import React from 'react';

// Simple test to verify the test environment works
test('basic test passes', () => {
  expect(true).toBe(true);
});

test('react works', () => {
  const element = React.createElement('div', null, 'Hello World');
  expect(element.type).toBe('div');
  expect(element.props.children).toBe('Hello World');
});
