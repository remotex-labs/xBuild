/**
 * Import will remove at compile time
 */

import type { ChildProcessWithoutNullStreams } from 'child_process';

/**
 * Imports
 */

import { spawn as osSpawn } from 'child_process';
import { spawn } from '@services/process.service';

/**
 * Mocks
 */

const spawnMock = xJet.mock(osSpawn);
const logSpy = xJet.spyOn(console, 'log');
const errorSpy = xJet.spyOn(console, 'error');

/**
 * Tests
 */

describe('spawn', () => {
    let mockProcess: ChildProcessWithoutNullStreams;

    beforeEach(() => {
        xJet.resetAllMocks();
        mockProcess = <any> {
            stdout: {
                on: xJet.fn((event, callback: (data: Buffer) => void) => {
                    if (event === 'data') {
                        callback(Buffer.from('Mock output'));
                    }
                })
            },
            stderr: {
                on: xJet.fn((event, callback: (data: Buffer) => void) => {
                    if (event === 'data') {
                        callback(Buffer.from('Mock error'));
                    }
                })
            },
            on: xJet.fn()
        };

        // Mock the implementation of the spawn function
        spawnMock.mockReturnValue(mockProcess);
    });

    afterEach(() => {
        // Clean up spies
        logSpy.mockReset();
        errorSpy.mockReset();
    });

    test('should spawn a new Node.js process with the correct arguments', () => {
        const filePath = './path/to/script.js';
        const processInstance = spawn(filePath);

        // Verify that console.log and console.error are called with expected values
        expect(logSpy).toHaveBeenCalledWith('Mock output');
        expect(errorSpy).toHaveBeenCalledWith('Mock error');

        expect(osSpawn).toHaveBeenCalledWith('node', [ '--enable-source-maps', filePath ]);
        expect(processInstance).toBe(mockProcess);
    });

    test('should log stdout and stderr data', () => {
        spawn('./path/to/script.js');

        // Verify that console.log and console.error are called with expected values
        expect(logSpy).toHaveBeenCalledWith('Mock output');
        expect(errorSpy).toHaveBeenCalledWith('Mock error');

        // Clean up spies
        logSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test('should return the ChildProcessWithoutNullStreams object', () => {
        const filePath = './path/to/script.js';
        const processInstance = spawn(filePath);

        expect(processInstance).toBe(mockProcess);
    });
});
