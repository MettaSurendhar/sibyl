/**
 * __tests__/services/MediaController.test.js
 * Tests for the MediaController singleton that routes
 * notification button presses to the active screen.
 */

import { MediaController } from '../../src/services/MediaController';

afterEach(() => {
  MediaController.unregister();
});

// ─── Register / Unregister ────────────────────────────────────────────────────
describe('MediaController — register / unregister', () => {
  it('returns false from onAction when no handler is registered', () => {
    expect(MediaController.onAction('play')).toBe(false);
  });

  it('returns true from onAction when a handler is registered', () => {
    MediaController.register({ onPlay: jest.fn() });
    expect(MediaController.onAction('play')).toBe(true);
  });

  it('clears handler after unregister()', () => {
    MediaController.register({ onPlay: jest.fn() });
    MediaController.unregister();
    expect(MediaController.onAction('play')).toBe(false);
  });

  it('only clears the matching handler when called with a reference', () => {
    const h1 = { onPlay: jest.fn() };
    const h2 = { onPlay: jest.fn() };
    MediaController.register(h1);
    MediaController.register(h2); // h2 is now active
    MediaController.unregister(h1); // h1 is stale — should not clear h2
    expect(MediaController.onAction('play')).toBe(true);
    expect(h2.onPlay).toHaveBeenCalledTimes(1);
  });
});

// ─── Action routing ───────────────────────────────────────────────────────────
describe('MediaController — action routing', () => {
  let handler;

  beforeEach(() => {
    handler = {
      onPlay: jest.fn(),
      onPause: jest.fn(),
      onSave: jest.fn(),
      onDiscard: jest.fn(),
      onFwd: jest.fn(),
      onBwd: jest.fn(),
      onCancel: jest.fn(),
    };
    MediaController.register(handler);
  });

  it('routes "play" to onPlay', () => {
    MediaController.onAction('play');
    expect(handler.onPlay).toHaveBeenCalledTimes(1);
  });

  it('routes "pause" to onPause', () => {
    MediaController.onAction('pause');
    expect(handler.onPause).toHaveBeenCalledTimes(1);
  });

  it('routes "save" to onSave', () => {
    MediaController.onAction('save');
    expect(handler.onSave).toHaveBeenCalledTimes(1);
  });

  it('routes "discard" to onDiscard', () => {
    MediaController.onAction('discard');
    expect(handler.onDiscard).toHaveBeenCalledTimes(1);
  });

  it('routes "fwd" to onFwd', () => {
    MediaController.onAction('fwd');
    expect(handler.onFwd).toHaveBeenCalledTimes(1);
  });

  it('routes "bwd" to onBwd', () => {
    MediaController.onAction('bwd');
    expect(handler.onBwd).toHaveBeenCalledTimes(1);
  });

  it('routes "cancel" to onCancel', () => {
    MediaController.onAction('cancel');
    expect(handler.onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not throw for unknown action', () => {
    expect(() => MediaController.onAction('unknownAction')).not.toThrow();
  });

  it('does not call any handler when it is missing from the registered object', () => {
    MediaController.register({}); // handler with no methods
    expect(() => MediaController.onAction('play')).not.toThrow();
  });
});
