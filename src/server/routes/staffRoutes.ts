import express from 'express';
import User from '../models/User';
import { protect, isStaff, hasPrivilegeKey } from '../middleware/auth';

const router = express.Router();

// Все маршруты требуют аутентификации и роли staff
router.use(protect);
router.use(isStaff);

// Получить всех сотрудников (только для staff с ключом привилегий)
router.get('/', hasPrivilegeKey, async (_req, res) => {
  try {
    console.log('Fetching all staff members');
    const staffMembers = await User.find({ role: 'staff' })
      .select('name email role privilegeKey createdAt')
      .sort({ createdAt: -1 });

    // Скрываем значение ключа привилегий (заменяем на булево значение о наличии)
    const sanitizedStaff = staffMembers.map(staff => {
      const staffObj = staff.toObject() as any;
      // Проверка наличия ключа привилегий (без раскрытия самого ключа)
      staffObj.hasPrivileges = Boolean(staffObj.privilegeKey && staffObj.privilegeKey.trim() !== '');
      delete staffObj.privilegeKey;
      return staffObj;
    });

    console.log(`Found ${staffMembers.length} staff members`);
    return res.json(sanitizedStaff);
  } catch (error) {
    console.error('Error fetching staff members:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Получить информацию о конкретном сотруднике
router.get('/:id', hasPrivilegeKey, async (req, res) => {
  try {
    const { id } = req.params;
    const staffMember = await User.findById(id).select('name email role createdAt');
    
    if (!staffMember) {
      return res.status(404).json({ message: 'Сотрудник не найден' });
    }

    if (staffMember.role !== 'staff') {
      return res.status(400).json({ message: 'Указанный пользователь не является сотрудником' });
    }

    // Проверяем наличие ключа привилегий (без раскрытия самого ключа)
    const staffObj = staffMember.toObject() as any;
    staffObj.hasPrivileges = Boolean((staffMember as any).privilegeKey && (staffMember as any).privilegeKey.trim() !== '');
    delete staffObj.privilegeKey;

    return res.json(staffObj);
  } catch (error) {
    console.error('Error fetching staff member:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Обновить привилегии сотрудника (только для staff с ключом привилегий)
router.patch('/:id/privileges', hasPrivilegeKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { grantPrivileges } = req.body;

    // Проверяем, что целевой пользователь существует и является сотрудником
    const targetStaff = await User.findById(id);
    if (!targetStaff) {
      return res.status(404).json({ message: 'Сотрудник не найден' });
    }

    if (targetStaff.role !== 'staff') {
      return res.status(400).json({ message: 'Указанный пользователь не является сотрудником' });
    }

    // Получаем значение ключа из переменных окружения или используем fallback значение
    const validPrivilegeKey = process.env.STAFF_PRIVILEGE_KEY || 'ADMIN_ACCESS_2024_SECURE_KEY_xyz789';
    if (!validPrivilegeKey) {
      return res.status(500).json({ 
        message: 'Ошибка конфигурации сервера: не задан ключ привилегий' 
      });
    }

    // В зависимости от действия, устанавливаем или удаляем ключ привилегий
    if (grantPrivileges) {
      targetStaff.privilegeKey = validPrivilegeKey;
      await targetStaff.save();
      return res.json({ 
        message: 'Привилегии сотруднику успешно предоставлены', 
        hasPrivileges: true 
      });
    } else {
      targetStaff.privilegeKey = '';
      await targetStaff.save();
      return res.json({ 
        message: 'Привилегии сотрудника успешно отозваны', 
        hasPrivileges: false 
      });
    }
  } catch (error) {
    console.error('Error updating staff privileges:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Добавить нового сотрудника (только для staff с ключом привилегий)
router.post('/', hasPrivilegeKey, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Валидация входных данных
    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: 'Пожалуйста, заполните все обязательные поля' 
      });
    }

    // Проверка, не существует ли уже пользователь с таким email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Пользователь с таким email уже существует' 
      });
    }

    // Создаем нового сотрудника
    const newStaff = new User({
      name,
      email,
      password,
      role: 'staff'
    });

    await newStaff.save();

    // Возвращаем созданного сотрудника (без пароля)
    const staffData = {
      id: newStaff._id,
      name: newStaff.name,
      email: newStaff.email,
      role: newStaff.role,
      createdAt: newStaff.createdAt,
      hasPrivileges: false
    };

    return res.status(201).json({ 
      message: 'Сотрудник успешно создан', 
      staff: staffData 
    });
  } catch (error) {
    console.error('Error creating staff member:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Удалить сотрудника (только для staff с ключом привилегий)
router.delete('/:id', hasPrivilegeKey, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Не позволяем удалить самого себя
    if (req.user._id.toString() === id) {
      return res.status(400).json({ 
        message: 'Вы не можете удалить свою собственную учетную запись' 
      });
    }

    const staffMember = await User.findById(id);
    if (!staffMember) {
      return res.status(404).json({ message: 'Сотрудник не найден' });
    }

    if (staffMember.role !== 'staff') {
      return res.status(400).json({ message: 'Указанный пользователь не является сотрудником' });
    }

    await User.findByIdAndDelete(id);
    return res.json({ 
      message: 'Сотрудник успешно удален',
      deletedStaffId: id
    });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router; 