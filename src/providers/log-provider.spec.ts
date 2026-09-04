/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { LifecycleLogsType } from '@interfaces/lifecycle.interface';
import type { LogOverridesType } from '@providers/interfaces/log-provider.interface';

/**
 * Imports
 */

import { collectLog, collectLogs, resolveLevel } from '@providers/log.provider';

/**
 * Tests
 */

describe('resolveLevel', () => {
    test.each(
        { case: 'an empty table', overrides: {} },
        { case: 'a table claiming another identifier', overrides: { 'empty-glob': 'silent' } }
    )('should keep the given level for $case', ({ overrides }) => {
        expect(resolveLevel(<LogOverridesType> overrides, 'direct-eval', 'warning')).toBe('warning');
    });

    test('should consult no override for a message carrying no identifier', () => {
        expect(resolveLevel({ '.*': 'error' }, undefined, 'info')).toBe('info');
    });

    test('should let a key naming the identifier decide the level', () => {
        expect(resolveLevel({ 'direct-eval': 'error' }, 'direct-eval', 'warning')).toBe('error');
    });

    test('should match a key naming an identifier over the whole identifier', () => {
        const overrides: LogOverridesType = { 'direct-eval': 'error' };

        expect(resolveLevel(overrides, 'x-direct-eval', 'warning')).toBe('warning');
        expect(resolveLevel(overrides, 'direct-eval-x', 'warning')).toBe('warning');
    });

    test('should read a key carrying regular-expression syntax as a pattern', () => {
        const overrides: LogOverridesType = { 'a.c': 'info' };

        expect(resolveLevel(overrides, 'abc', 'warning')).toBe('info');
        expect(resolveLevel(overrides, 'ac', 'warning')).toBe('warning');
    });

    test('should anchor a pattern so an alternation keeps both sides whole', () => {
        const overrides: LogOverridesType = { 'empty-glob|direct-eval': 'error' };

        expect(resolveLevel(overrides, 'empty-glob', 'warning')).toBe('error');
        expect(resolveLevel(overrides, 'direct-eval', 'warning')).toBe('error');
        expect(resolveLevel(overrides, 'x-direct-eval', 'warning')).toBe('warning');
    });

    test('should let a key naming the identifier win over a pattern that also matches', () => {
        const overrides: LogOverridesType = { '.*': 'error', 'direct-eval': 'debug' };

        expect(resolveLevel(overrides, 'direct-eval', 'warning')).toBe('debug');
        expect(resolveLevel(overrides, 'empty-glob', 'warning')).toBe('error');
    });

    test('should let the first pattern the table declared win', () => {
        const overrides: LogOverridesType = { 'direct-.*': 'debug', '.*-eval': 'error' };

        expect(resolveLevel(overrides, 'direct-eval', 'warning')).toBe('debug');
    });

    test('should skip a pattern whose syntax does not parse', () => {
        const overrides: LogOverridesType = { '(unclosed': 'silent', '.*-eval': 'error' };

        expect(resolveLevel(overrides, 'direct-eval', 'warning')).toBe('error');
    });

    test('should keep the given level when the only key does not parse', () => {
        expect(resolveLevel({ '(unclosed': 'silent' }, 'direct-eval', 'warning')).toBe('warning');
    });

    test('should let a key naming the identifier decide even when it does not parse as a pattern', () => {
        expect(resolveLevel({ '(unclosed': 'silent' }, '(unclosed', 'warning')).toBe('silent');
    });

    test('should read no inherited property as an override', () => {
        expect(resolveLevel({}, 'constructor', 'info')).toBe('info');
        expect(resolveLevel({}, 'toString', 'info')).toBe('info');
    });

});

describe('collectLog', () => {
    let logs: LifecycleLogsType;

    beforeEach(() => {
        logs = { debug: [], info: [], warning: [], error: [] };
    });

    test('should file a message under the level it was given', () => {
        collectLog(logs, {}, { text: 'bundling' }, 'info');

        expect(logs).toEqual({ debug: [], info: [{ text: 'bundling' }], warning: [], error: [] });
    });

    test('should let an override matching the identifier decide the level', () => {
        collectLog(logs, { 'direct-eval': 'error' }, { id: 'direct-eval', text: 'eval used' }, 'warning');

        expect(logs.error).toEqual([{ id: 'direct-eval', text: 'eval used' }]);
        expect(logs.warning).toEqual([]);
    });

    test('should keep the given level for an identifier no override matches', () => {
        collectLog(logs, { 'direct-eval': 'error' }, { id: 'empty-glob', text: 'nothing matched' }, 'warning');

        expect(logs.warning).toEqual([{ id: 'empty-glob', text: 'nothing matched' }]);
        expect(logs.error).toEqual([]);
    });

    test('should drop a message an override silenced', () => {
        collectLog(logs, { 'direct-eval': 'silent' }, { id: 'direct-eval', text: 'eval used' }, 'error');

        expect(logs).toEqual({ debug: [], info: [], warning: [], error: [] });
    });

    test('should drop a message the given level silenced', () => {
        collectLog(logs, {}, { text: 'bundling' }, 'silent');

        expect(logs).toEqual({ debug: [], info: [], warning: [], error: [] });
    });

    test('should raise a silenced level when an override names one', () => {
        collectLog(logs, { 'direct-eval': 'error' }, { id: 'direct-eval', text: 'eval used' }, 'silent');

        expect(logs.error).toEqual([{ id: 'direct-eval', text: 'eval used' }]);
    });

    test('should append rather than replace what a level already carries', () => {
        collectLog(logs, {}, { text: 'first' }, 'info');
        collectLog(logs, {}, { text: 'second' }, 'info');

        expect(logs.info).toEqual([{ text: 'first' }, { text: 'second' }]);
    });
});

describe('collectLogs', () => {
    let logs: LifecycleLogsType;

    beforeEach(() => {
        logs = { debug: [], info: [], warning: [], error: [] };
    });

    test('should route every message the way it was told to', () => {
        const overrides: LogOverridesType = { 'direct-eval': 'error', 'empty-glob': 'silent' };

        collectLogs(logs, overrides, [
            { id: 'direct-eval', text: 'eval used' },
            { id: 'empty-glob', text: 'nothing matched' },
            { text: 'bundling' }
        ], 'warning');

        expect(logs).toEqual({
            debug: [],
            info: [],
            error: [{ id: 'direct-eval', text: 'eval used' }],
            warning: [{ text: 'bundling' }]
        });
    });

    test('should keep the order the messages arrived in', () => {
        collectLogs(logs, {}, [{ text: 'first' }, { text: 'second' }], 'debug');

        expect(logs.debug).toEqual([{ text: 'first' }, { text: 'second' }]);
    });

    test('should file nothing for an empty batch', () => {
        collectLogs(logs, {}, [], 'error');

        expect(logs).toEqual({ debug: [], info: [], warning: [], error: [] });
    });

    test('should credit every message to the plugin it was given', () => {
        collectLogs(logs, {}, [{ text: 'first' }, { text: 'second' }], 'error', 'xbuild');

        expect(logs.error).toEqual([
            { text: 'first', pluginName: 'xbuild' },
            { text: 'second', pluginName: 'xbuild' }
        ]);
    });

    test('should credit no plugin when it is named none', () => {
        collectLogs(logs, {}, [{ text: 'first' }], 'error');
        collectLogs(logs, {}, [{ text: 'second' }], 'error', '');

        expect(logs.error).toEqual([{ text: 'first' }, { text: 'second' }]);
        expect(logs.error.some(message => 'pluginName' in message)).toBe(false);
    });

    test('should credit the plugin over a name the message already carried', () => {
        collectLogs(logs, {}, [{ text: 'first', pluginName: 'other' }], 'error', 'xbuild');

        expect(logs.error[0].pluginName).toBe('xbuild');
    });

    test('should credit a message the override goes on to drop', () => {
        const message = { id: 'direct-eval', text: 'eval used' };

        collectLogs(logs, { 'direct-eval': 'silent' }, [ message ], 'error', 'xbuild');

        expect(logs.error).toEqual([]);
        expect(message).toEqual({ id: 'direct-eval', text: 'eval used', pluginName: 'xbuild' });
    });
});
