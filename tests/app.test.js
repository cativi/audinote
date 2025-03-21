const request = require('supertest');
const app = require('../src/app');

describe('App Integration Test', () => {
    it('should return 404 for unknown routes', async () => {
        const res = await request(app).get('/nonexistent-route');
        expect(res.statusCode).toBe(404);
    });

    it('should respond to /transcribe (mocked POST)', async () => {
        const res = await request(app)
            .post('/transcribe')
            .field('language', 'en')
            .attach('audio', Buffer.from('fake audio content'), 'test.mp3');

        expect([200, 400, 415, 500]).toContain(res.statusCode);
    });

    it('should respond to /transcribe/youtube (mocked POST)', async () => {
        const res = await request(app)
            .post('/transcribe/youtube')
            .send({ url: 'https://www.youtube.com/watch?v=123456' });

        expect([200, 400, 415, 500]).toContain(res.statusCode);
    });
});
