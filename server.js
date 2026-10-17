const fastify = require('fastify')({ logger: true });

fastify.get('/', async (request, reply) => {
  return { mensaje: '¡Hola! El servidor está funcionando en el puerto 3000' }
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log('Servidor corriendo en http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();