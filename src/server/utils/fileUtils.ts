import fs from 'fs';
import path from 'path';

/**
 * Проверяет и создает директории для загрузки файлов, если они не существуют
 * @returns Информация о директориях
 */
export function checkAndCreateDirectories(): { success: boolean; dirs: { [key: string]: boolean }; paths: { [key: string]: string } } {
  try {
    // Путь к корневой директории проекта
    const rootDir = path.join(__dirname, '../../../');
    
    // Директории, которые нужно создать
    const uploadDir = path.join(rootDir, 'uploads');
    const avatarDir = path.join(uploadDir, 'avatars');
    
    const dirs = {
      uploads: false,
      avatars: false
    };
    
    const paths = {
      root: rootDir,
      uploads: uploadDir,
      avatars: avatarDir
    };
    
    console.log('🔍 Проверка директорий:');
    console.log(`- Корневая директория: ${rootDir}`);
    console.log(`- Директория для загрузок: ${uploadDir}`);
    console.log(`- Директория для аватаров: ${avatarDir}`);
    
    // Создаем директорию uploads, если она не существует
    if (!fs.existsSync(uploadDir)) {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`✅ Создана директория: ${uploadDir}`);
      } catch (err) {
        console.error('❌ Ошибка при создании директории uploads:', err);
        return { success: false, dirs, paths };
      }
    }
    dirs.uploads = fs.existsSync(uploadDir);
    
    // Создаем директорию avatars, если она не существует
    if (!fs.existsSync(avatarDir)) {
      try {
        fs.mkdirSync(avatarDir, { recursive: true });
        console.log(`✅ Создана директория: ${avatarDir}`);
      } catch (err) {
        console.error('❌ Ошибка при создании директории avatars:', err);
        return { success: false, dirs, paths };
      }
    }
    dirs.avatars = fs.existsSync(avatarDir);
    
    console.log(`📂 Статус директорий: uploads=${dirs.uploads}, avatars=${dirs.avatars}`);
    
    // Проверка прав доступа к директориям
    try {
      const testFile = path.join(avatarDir, '.test');
      fs.writeFileSync(testFile, 'test', { encoding: 'utf8' });
      console.log(`✅ Тестовый файл создан: ${testFile}`);
      
      const exists = fs.existsSync(testFile);
      console.log(`📄 Тестовый файл существует: ${exists}`);
      
      if (exists) {
        fs.unlinkSync(testFile);
        console.log(`✅ Тестовый файл удален: ${testFile}`);
      }
    } catch (err) {
      console.error('❌ Ошибка проверки прав доступа:', err);
      return { success: false, dirs, paths };
    }
    
    return { success: true, dirs, paths };
  } catch (err) {
    console.error('❌ Ошибка при проверке директорий:', err);
    return { 
      success: false, 
      dirs: { uploads: false, avatars: false },
      paths: { root: '', uploads: '', avatars: '' } 
    };
  }
}

/**
 * Получает полный путь к файлу аватара
 * @param avatarPath Относительный путь к аватару
 * @returns Полный путь к файлу
 */
export function getAvatarFullPath(avatarPath: string): string {
  try {
    // Получаем директорию проекта
    const rootDir = path.join(__dirname, '../../../');
    
    // Убираем начальный слеш, если есть
    const normalizedPath = avatarPath.startsWith('/') ? avatarPath.substring(1) : avatarPath;
    
    // Формируем полный путь
    let fullPath = '';
    if (normalizedPath.startsWith('avatars/')) {
      // Если путь начинается с avatars/, обрабатываем его как относительный к директории uploads
      fullPath = path.join(rootDir, 'uploads', normalizedPath);
    } else {
      // Иначе обрабатываем как путь внутри директории аватаров
      fullPath = path.join(rootDir, 'uploads', 'avatars', normalizedPath);
    }
    
    console.log(`📄 Путь к аватару: ${avatarPath} -> ${fullPath}`);
    
    return fullPath;
  } catch (err) {
    console.error('❌ Ошибка при формировании пути к аватару:', err);
    // В случае ошибки возвращаем путь как есть
    return avatarPath;
  }
}

/**
 * Проверяет существование файла аватара
 * @param avatarPath Путь к аватару
 * @returns Существует ли файл
 */
export function avatarExists(avatarPath: string): boolean {
  if (!avatarPath) {
    console.log('⚠️ Пустой путь к аватару');
    return false;
  }
  
  try {
    const fullPath = getAvatarFullPath(avatarPath);
    const exists = fs.existsSync(fullPath);
    console.log(`📄 Проверка существования аватара: ${avatarPath} -> ${exists}`);
    return exists;
  } catch (err) {
    console.error('❌ Ошибка при проверке существования аватара:', err);
    return false;
  }
} 