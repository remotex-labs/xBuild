module.exports = {
    transform: {
        "^.+\\.(t|j)sx?$": [
            "@swc/jest",
            {
                jsc: {
                    target: "esnext",
                    transform: {
                        optimizer: {
                            globals: {
                                vars: {
                                    "import.meta.dirname": "'dist'"
                                }
                            }
                        }
                    }
                }
            }
        ]
    },
    collectCoverageFrom: [
        'src/**/*.{ts,tsx,js,jsx}',
        '!**/*.d.ts',
    ],
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    testPathIgnorePatterns: [ '/lib/', '/node_modules/', '/dist/' ],
    transformIgnorePatterns: [
        '/node_modules/(?!@remotex-labs/xmap)',
    ],
    moduleNameMapper: {
        '^@errors/(.*)$': '<rootDir>/src/errors/$1',
        '^@plugins/(.*)$': '<rootDir>/src/errors/$1',
        '^@services/(.*)$': '<rootDir>/src/services/$1',
        '^@providers/(.*)$': '<rootDir>/src/providers/$1',
        '^@components/(.*)$': '<rootDir>/src/components/$1',
        '^@configuration/(.*)$': '<rootDir>/src/configuration/$1',
        '^@typescript/(.*)$': '<rootDir>/src/modules/typescript/$1'
    },
    resetMocks: true,
    resetModules: true,
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
