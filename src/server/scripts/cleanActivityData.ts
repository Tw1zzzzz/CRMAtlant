import mongoose from 'mongoose';
import dotenv from 'dotenv';
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

// Функция очистки данных активности
const cleanActivityData = async () => {
  try {
    // Подключаемся к базе данных
    await connectDB();
    
    // Проверяем, есть ли записи активности
    const existingActivities = await ActivityHistory.countDocuments();
    
    if (existingActivities > 0) {
      console.log(`В базе найдено ${existingActivities} записей активности. Удаляем все записи...`);
      
      // Удаляем все записи активности
      const result = await ActivityHistory.deleteMany({});
      console.log(`Удалено ${result.deletedCount} записей активности`);
    } else {
      console.log('В базе данных не найдено записей активности');
    }
    
    // Закрываем соединение с базой данных
    await mongoose.disconnect();
    
    console.log('Очистка завершена успешно!');
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при очистке данных активности:', error);
    
    // Закрываем соединение с базой данных
    await mongoose.disconnect();
    
    process.exit(1);
  }
};

// Запуск скрипта
cleanActivityData(); 