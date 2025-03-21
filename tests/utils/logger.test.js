const logger = require('../../src/utils/logger');
const winston = require('winston');

describe('Logger Utility', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = process.env.NODE_ENV;
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        jest.restoreAllMocks();
        jest.resetModules();
    });

    test('should log with debug level in development', () => {
        process.env.NODE_ENV = 'development';
        jest.resetModules();
        const devLogger = require('../../src/utils/logger');
        expect(devLogger.level).toBe('debug');
    });

    test('should log with info level in production', () => {
        process.env.NODE_ENV = 'production';
        jest.resetModules();
        const prodLogger = require('../../src/utils/logger');
        expect(prodLogger.level).toBe('info');
    });

    test('should include Console transport', () => {
        // Instead of using toBeInstanceOf (which may fail if multiple Winston copies are loaded),
        // we check that the first transport has the 'name' property set to 'console'.
        expect(logger.transports.length).toBeGreaterThan(0);
        expect(logger.transports[0]).toHaveProperty('name', 'console');
    });

    test('should log without throwing error', () => {
        expect(() => logger.info('Test log')).not.toThrow();
        expect(() => logger.error('Test error')).not.toThrow();
        expect(() => logger.warn('Test warn')).not.toThrow();
        expect(() => logger.debug('Test debug')).not.toThrow();
    });
});
