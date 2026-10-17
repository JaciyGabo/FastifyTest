const fastify = require('fastify')({ logger: true });

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

fastify.get('/', async (request, reply) => {
  return { mensaje: `¡Hola! El servidor está funcionando en el puerto ${PORT}` };
});

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();