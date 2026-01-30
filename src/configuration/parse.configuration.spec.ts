/**
 * Imports
 */

import { URL } from 'url';
import { readFileSync } from 'fs';
import { sandboxExecute } from '@services/vm.service';
import { transpileFile } from '@services/transpiler.service';
import { parseConfigurationFile } from '@configuration/parse.configuration';

/**
 * Mocks
 */

(<any> globalThis).URL = URL; //todo fix tests mock
afterAll(() => xJet.restoreAllMocks());
xJet.mock(readFileSync).mockReturnValue(JSON.stringify({
    version: 3,
    file: 'index.js',
    sources: [ 'source.js' ],
    names: [],
    mappings: 'AAAA',
    sourcesContent: [ 'asd' ]
}));

/**
 * Tests
 */

describe('parseConfigurationFile', () => {
    test('should transpile the configuration file and return the parsed configuration object', async () => {
        xJet.mock(transpileFile).mockResolvedValue({
            code: 'transpiledCode',
            sourceMap: 'eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sInNvdXJjZXMiOltdLCJzb3VyY2VzQ29udGVudCI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxDQUFDOztBQUNBIn0='
        });

        xJet.mock(sandboxExecute).mockImplementation((code: string, context: any): any => {
            context.module.exports.default = { dev: true, watch: true };
        });

        const config = await parseConfigurationFile('valid.config.ts');

        expect(transpileFile).toHaveBeenCalledWith('valid.config.ts', expect.any(Object));
        expect(config).toEqual({ dev: true, watch: true });
    });

    test('should return the default configuration when the sandbox does not modify exports', async () => {
        xJet.mock(transpileFile).mockResolvedValue({
            code: 'transpiledCode',
            sourceMap: 'eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sInNvdXJjZXMiOltdLCJzb3VyY2VzQ29udGVudCI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxDQUFDOztBQUNBIn0='
        });

        xJet.mock(sandboxExecute).mockImplementation((code: string, context: any): any => {
            context.module.exports.default = {};
        });

        const config = await parseConfigurationFile('empty.config.ts');
        expect(config).toEqual({});
    });

    test('should attach source to error when an error occurs in parseConfigurationFile', async () => {
        xJet.mock(transpileFile).mockResolvedValue({
            code: 'transpiledCode',
            sourceMap: 'eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sInNvdXJjZXMiOltdLCJzb3VyY2VzQ29udGVudCI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxDQUFDOztBQUNBIn0='
        });

        const error = new Error('Test error');
        xJet.mock(sandboxExecute).mockRejectedValue(error);

        await expect(parseConfigurationFile('invalid.config.ts')).rejects.toThrow('Test error');
    });
});

describe('wrapAllFunctions', () => {
    test('should wrap functions within an object and handle errors correctly', async () => {
        const obj = {
            fn1: xJet.fn(() => {
                throw new Error('Function 1 error');
            }),
            nested: {
                fn2: xJet.fn(() => {
                    throw new Error('Function 2 error');
                })
            }
        };

        xJet.mock(transpileFile).mockResolvedValue({
            code: 'transpiledCode',
            sourceMap: 'eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sInNvdXJjZXMiOltdLCJzb3VyY2VzQ29udGVudCI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxDQUFDOztBQUNBIn0='
        });

        xJet.mock(sandboxExecute).mockImplementation((code: string, context: any): any => {
            context.module.exports.default = obj;
        });

        const config: any = await parseConfigurationFile('empty.config.ts');

        expect(() => config.fn1()).toThrow('Function 1 error');
        expect(() => config.nested.fn2()).toThrow('Function 2 error');
    });
});
