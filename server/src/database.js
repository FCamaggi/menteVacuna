import { MongoClient } from 'mongodb';

export class DatabaseManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.lobbies = null;
  }

  async connect() {
    const uri = process.env.MONGODB_URI;
    
    if (!uri || uri.includes('localhost')) {
      console.log('MongoDB no configurado, usando modo memoria');
      this.useMemoryMode = true;
      this.memoryStore = new Map();
      return;
    }

    try {
      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db();
      this.lobbies = this.db.collection('lobbies');
      
      // Crear índice para expiración automática (lobbies antiguos)
      await this.lobbies.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 86400 } // 24 horas
      );
      
      console.log('MongoDB conectado exitosamente');
    } catch (error) {
      console.error('Error conectando a MongoDB, usando modo memoria:', error);
      this.useMemoryMode = true;
      this.memoryStore = new Map();
    }
  }

  async saveLobby(lobbyData) {
    if (this.useMemoryMode) {
      this.memoryStore.set(lobbyData.lobbyCode, {
        ...lobbyData,
        updatedAt: new Date()
      });
      return;
    }

    await this.lobbies.updateOne(
      { lobbyCode: lobbyData.lobbyCode },
      { 
        $set: { 
          ...lobbyData, 
          updatedAt: new Date() 
        } 
      },
      { upsert: true }
    );
  }

  async getLobby(lobbyCode) {
    if (this.useMemoryMode) {
      return this.memoryStore.get(lobbyCode) || null;
    }

    return await this.lobbies.findOne({ lobbyCode });
  }

  async deleteLobby(lobbyCode) {
    if (this.useMemoryMode) {
      this.memoryStore.delete(lobbyCode);
      return;
    }

    await this.lobbies.deleteOne({ lobbyCode });
  }

  async updateLobby(lobbyCode, updates) {
    if (this.useMemoryMode) {
      const lobby = this.memoryStore.get(lobbyCode);
      if (lobby) {
        this.memoryStore.set(lobbyCode, {
          ...lobby,
          ...updates,
          updatedAt: new Date()
        });
      }
      return;
    }

    await this.lobbies.updateOne(
      { lobbyCode },
      { 
        $set: { 
          ...updates, 
          updatedAt: new Date() 
        } 
      }
    );
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
    }
  }
}
