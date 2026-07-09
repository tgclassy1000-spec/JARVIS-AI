import { isTrustedRendererUrl } from '../../src/main/security/navigation';

describe('renderer navigation policy', () => {
  it('allows only packaged files in production', () => {
    expect(isTrustedRendererUrl('file:///app/out/renderer/index.html', false)).toBe(true);
    expect(isTrustedRendererUrl('https://example.com', false)).toBe(false);
  });

  it('restricts development navigation to known local origins', () => {
    expect(isTrustedRendererUrl('http://localhost:5173/', true)).toBe(true);
    expect(
      isTrustedRendererUrl('http://localhost:5174/dashboard', true, 'http://localhost:5174'),
    ).toBe(true);
    expect(
      isTrustedRendererUrl('http://localhost:5173/dashboard', true, 'http://localhost:5174'),
    ).toBe(false);
    expect(isTrustedRendererUrl('http://localhost.evil.test:5173', true)).toBe(false);
    expect(isTrustedRendererUrl('not a url', true)).toBe(false);
  });
});
