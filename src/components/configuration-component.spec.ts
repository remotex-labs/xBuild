/**
 * Imports
 */

import { flagOptions, typesOptions, declarationOptions } from './configuration.component';

/**
 * Tests
 */

describe('flagOptions', () => {
    test.each(
        { case: 'a flag that was left out', value: undefined, expected: undefined },
        { case: 'a flag that was switched off', value: false, expected: undefined },
        { case: 'a flag that was switched on', value: true, expected: {} },
        { case: 'the options it was given', value: { outDir: 'types' }, expected: { outDir: 'types' } }
    )('should read $case', ({ value, expected }) => {
        expect(flagOptions(value)).toEqual(expected);
    });

    test('should hand the options back rather than a copy of them', () => {
        const options = { outDir: 'types' };

        expect(flagOptions(options)).toBe(options);
    });

    test('should build an object of its own for a flag that carries none', () => {
        expect(flagOptions(true)).not.toBe(flagOptions(true));
    });
});

describe('typesOptions', () => {
    test.each(
        { case: 'names none', config: {}, expected: undefined },
        { case: 'switches them off', config: { types: false }, expected: undefined },
        { case: 'switches them on', config: { types: true }, expected: {} },
        { case: 'spells them out', config: { types: { failOnError: true } }, expected: { failOnError: true } }
    )('should read the type-check options of a configuration that $case', ({ config, expected }) => {
        expect(typesOptions(config)).toEqual(expected);
    });

    test('should read the type-check flag rather than any other', () => {
        expect(typesOptions({ types: false, declaration: true })).toBeUndefined();
    });
});

describe('declarationOptions', () => {
    test.each(
        { case: 'names none', config: {}, expected: undefined },
        { case: 'switches them off', config: { declaration: false }, expected: undefined },
        { case: 'switches them on', config: { declaration: true }, expected: {} },
        { case: 'spells them out', config: { declaration: { bundle: true } }, expected: { bundle: true } }
    )('should read the declaration options of a configuration that $case', ({ config, expected }) => {
        expect(declarationOptions(config)).toEqual(expected);
    });

    test('should read the declaration flag rather than any other', () => {
        expect(declarationOptions({ types: true, declaration: false })).toBeUndefined();
    });
});
