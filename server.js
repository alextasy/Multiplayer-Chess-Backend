import { Server } from 'socket.io';
import { createServer } from 'http';
import logic from './socket.js';

const server = createServer();
const io = new Server(server, { cors: { origin: '*', methods: '*' } });
 
logic(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });