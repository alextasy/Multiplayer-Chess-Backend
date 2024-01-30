import { v4 as uuid } from 'uuid';

export default io => {
    let rooms = [];
    let inGameRooms = [];

    io.on('connection', socket => {

        socket.on('connectUser', userId => {
            socket.userId = userId;
            const roomPlayerWasIn = inGameRooms.find(room => room.visitorId === userId || room.creatorId === userId);
            if (!roomPlayerWasIn) return;

            if (roomPlayerWasIn.timeOut) clearTimeout(roomPlayerWasIn.timeOut);
            socket.join(roomPlayerWasIn.id);
            io.to(socket.id).emit('verifyLastMove', roomPlayerWasIn.lastMove || {}); // Opponent could have made a move while we were disconnected
        });

        function filterRooms(roomId = null) {
            rooms = rooms.filter(room => room.creatorId !== socket.userId && room.id !== roomId);
            io.emit('updateRooms', rooms);
        }

        socket.on('requestRooms', () => socket.emit('updateRooms', rooms));

        socket.on('createRoom', options => {
            const roomId = uuid();
            rooms.push({ ...options, id: roomId, creatorId: socket.userId });
            socket.join(roomId);
            socket.emit('roomJoined', roomId);
            socket.broadcast.emit('updateRooms', rooms);
        })

        socket.on('joinRoom', roomId => {
            socket.join(roomId);
            socket.emit('roomJoined', roomId);
            io.emit('gameStart');
            const room = rooms.find(room => room.id === roomId);
            room.visitorId = socket.userId;
            inGameRooms.push(room);
            filterRooms(roomId);
        })

        socket.on('message', ({ message, sender, roomId }) => {
            io.to(roomId).emit('message', { message, sender });
        })

        socket.on('move', ({ figIndex, nextSquareIndex, roomId }) => {
            const room = inGameRooms.find(room => room.id === roomId);
            room.lastMove = { figIndex, nextSquareIndex };
            socket.broadcast.to(roomId).emit('move', { figIndex, nextSquareIndex });
        })

        socket.on('leftRoom', roomId => {
            filterRooms();
            socket.broadcast.to(roomId).emit('opponentDisconnected');
        });

        socket.on('disconnect', () => {
            filterRooms();
            const roomPlayerWasIn = inGameRooms.find(room => room.visitorId === socket.userId || room.creatorId === socket.userId);
            if (!roomPlayerWasIn) return;
            
            roomPlayerWasIn.timeOut = setTimeout(() => {
                io.to(roomPlayerWasIn.id).emit('opponentDisconnected');
                inGameRooms = inGameRooms.filter(room => room.id !== roomPlayerWasIn.id);
            }, 15 * 1000);
        });

        socket.on('gameOver', roomId => {
            inGameRooms = inGameRooms.filter(room => room.id !== roomId)
        });
    });
}
