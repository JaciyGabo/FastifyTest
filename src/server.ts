import Fastify from 'fastify';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const fastify = Fastify({ logger: true });

fastify.get('/', async () => {
  return { mensaje: `¡Hola! El servidor está funcionando en el puerto ${PORT}` };
});

try {
  await fastify.listen({ port: PORT, host: HOST });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
