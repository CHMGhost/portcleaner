// Smoke test to verify test setup is working

describe('Test Setup Verification', () => {
  test('Jest is configured correctly', () => {
    expect(true).toBe(true);
  });
  
  test('Babel is transforming code', () => {
    const arrowFunction = () => 'works';
    expect(arrowFunction()).toBe('works');
  });
  
  test('Can use modern JavaScript features', () => {
    const obj = { a: 1, b: 2 };
    const { a, b } = obj;
    expect(a).toBe(1);
    expect(b).toBe(2);
  });
  
  test('Async/await works', async () => {
    const promise = Promise.resolve('async works');
    const result = await promise;
    expect(result).toBe('async works');
  });
  
  test('Mocking works', () => {
    const mockFn = jest.fn(() => 'mocked');
    mockFn();
    expect(mockFn).toHaveBeenCalled();
    expect(mockFn()).toBe('mocked');
  });
});