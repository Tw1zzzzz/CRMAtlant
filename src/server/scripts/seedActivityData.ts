import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import ActivityHistory from '../models/ActivityHistory';

// Загрузка переменных окружения
dotenv.config();

// Функция подключения к базе данных
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/esports-mood-tracker';
    console.log('Подключение к MongoDB...');
    
    await mongoose.connect(mongoURI);
    console.log('MongoDB подключена успешно!');
  } catch (error) {
    console.error('Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
};

// Функция добавления тестовых данных активности
const seedActivityData = async () => {
  try {
    // Подключаемся к базе данных
    await connectDB();
    
    // Получаем список пользователей
    const users = await User.find({});
    
    if (users.length === 0) {
      console.log('Пользователей не найдено. Создаем тестовых пользователей...');
      
      // Создаем тестовых пользователей если их нет
      const staffUser = await User.create({
        name: 'Администратор',
        email: 'admin@example.com',
        password: 'password123',
        role: 'staff'
      });
      
      const playerUser1 = await User.create({
        name: 'Игрок 1',
        email: 'player1@example.com',
        password: 'password123',
        role: 'player'
      });
      
      const playerUser2 = await User.create({
        name: 'Игрок 2',
        email: 'player2@example.com',
        password: 'password123',
        role: 'player'
      });
      
      users.push(staffUser, playerUser1, playerUser2);
      console.log('Создано 3 тестовых пользователя');
    }
    
    // Получаем ID игроков (пользователей с ролью player)
    const playerUsers = users.filter(user => user.role === 'player');
    
    if (playerUsers.length === 0) {
      console.log('Игроков не найдено. Создаем тестового игрока...');
      
      const playerUser = await User.create({
        name: 'Тестовый игрок',
        email: 'testplayer@example.com',
        password: 'password123',
        role: 'player'
      });
      
      playerUsers.push(playerUser);
      console.log('Создан тестовый игрок');
    }
    
    // Проверяем, есть ли уже записи активности
    const existingActivities = await ActivityHistory.countDocuments();
    
    if (existingActivities > 0) {
      console.log(`В базе уже есть ${existingActivities} записей активности. Удаляем старые записи...`);
      
      // Удаляем существующие записи активности
      await ActivityHistory.deleteMany({});
      console.log('Существующие записи активности удалены');
    }
    
    // Типы действий и сущностей
    const actionTypes = ['create', 'update', 'delete', 'login', 'logout', 'test_complete', 'mood_track', 'file_upload', 'balance_wheel'];
    const entityTypes = ['user', 'mood', 'test', 'file', 'balance_wheel', 'system'];
    
    // Генерация тестовых данных активности
    const activityRecords = [];
    
    // Текущая дата и дата месяц назад
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(now.getMonth() - 1);
    
    // Генерация записей активности для каждого игрока
    for (const player of playerUsers) {
      const recordsCount = Math.floor(Math.random() * 20) + 10; // От 10 до 30 записей для каждого игрока
      
      for (let i = 0; i < recordsCount; i++) {
        // Генерация случайной даты в последний месяц
        const recordDate = new Date(
          oneMonthAgo.getTime() + Math.random() * (now.getTime() - oneMonthAgo.getTime())
        );
        
        // Выбор случайного типа действия и сущности
        const action = actionTypes[Math.floor(Math.random() * actionTypes.length)];
        const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)];
        
        // Создаем запись активности
        activityRecords.push({
          userId: player._id,
          action,
          entityType,
          entityId: new mongoose.Types.ObjectId(), // Генерация случайного ID сущности
          details: {
            field1: `значение ${i}`,
            field2: Math.random() > 0.5 ? 'да' : 'нет',
            score: Math.floor(Math.random() * 100)
          },
          timestamp: recordDate
        });
      }
    }
    
    // Сохраняем записи активности в базу данных
    console.log(`Добавление ${activityRecords.length} записей активности...`);
    const insertedActivities = await ActivityHistory.insertMany(activityRecords);
    
    console.log(`Успешно добавлено ${insertedActivities.length} записей активности в базу данных`);
    
    // Закрываем соединение с базой данных
    await mongoose.disconnect();
    
    console.log('Скрипт успешно выполнен!');
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при добавлении тестовых данных:', error);
    
    // Закрываем соединение с базой данных
    await mongoose.disconnect();
    
    process.exit(1);
  }
};

// Запуск скрипта
seedActivityData(); 