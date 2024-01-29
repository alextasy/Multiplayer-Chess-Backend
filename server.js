import { Server } from 'socket.io';
import { createServer } from 'http';
import initSocket from './socket.js';

const PORT = process.env.PORT || 4000;

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Server is running on port ${PORT}`);
  }
});

const io = new Server(server, { cors: { origin: '*', methods: '*' } });
initSocket(io);

server.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });