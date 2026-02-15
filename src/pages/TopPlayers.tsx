import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Grid, 
  Paper, 
  Box, 
  Avatar, 
  Tabs, 
  Tab, 
  Card, 
  CardContent, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  useTheme,
  SelectChangeEvent
} from '@mui/material';
import {
  Star as StarIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { COLORS } from '../theme';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import UserAvatar from '@/components/UserAvatar';

interface Player {
  rank: number;
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  gamePoints: number;
  nonGamePoints: number;
  discipline: number;
}

interface Stats {
  totalPlayers: number;
  activePlayers: number;
  averageRating: number;
  monthlyTournaments: number;
}

// Создаем тип пользователя для UserAvatar, чтобы избежать ошибок типизации
interface PlayerUser {
  id: string;
  name: string;
  avatar?: string;
  email: string;
  role: 'player';
  _updateTimestamp?: number;
}

const TopPlayers: React.FC = () => {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('all');
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPlayers: 0,
    activePlayers: 0,
    averageRating: 0,
    monthlyTournaments: 0
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [pointsForm, setPointsForm] = useState({
    points: 0,
    pointType: 'gamePoints',
    operation: 'add'
  });
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';
  const theme = useTheme();
  
  // URL бэкенда
  const API_URL = import.meta.env.VITE_API_URL || '';
  
  // Загрузка данных игроков
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_URL}/api/player-rating/top?period=${period}`);
        setPlayers(response.data.players);
        setStats(response.data.stats);
        setError(null);
      } catch (err) {
        console.error('Ошибка при загрузке данных:', err);
        setError('Не удалось загрузить данные. Пожалуйста, попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [period, API_URL]);
  
  // Обработчик изменения периода
  const handleTabChange = (event: React.SyntheticEvent, newValue: 'week' | 'month' | 'all') => {
    setPeriod(newValue);
  };
  
  // Обработчик открытия диалога редактирования
  const handleOpenDialog = (player: Player) => {
    setSelectedPlayer(player);
    setPointsForm({
      points: 0,
      pointType: 'gamePoints',
      operation: 'add'
    });
  };
  
  // Обработчик закрытия диалога
  const handleCloseDialog = () => {
    setSelectedPlayer(null);
  };
  
  // Обработчик изменения текстового поля
  const handleTextFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setPointsForm(prev => ({ 
      ...prev, 
      [name]: name === 'points' ? parseInt(value) || 0 : value 
    }));
  };
  
  // Обработчик изменения селекторов
  const handleSelectChange = (event: SelectChangeEvent) => {
    const { name, value } = event.target;
    setPointsForm(prev => ({ 
      ...prev, 
      [name]: value 
    }));
  };
  
  // Обработчик отправки формы
  const handleSubmit = async () => {
    if (!selectedPlayer) return;
    
    try {
      setLoading(true);
      await axios.put(
        `${API_URL}/api/player-rating/${selectedPlayer.id}`,
        pointsForm,
        { 
          headers: { 
            Authorization: `Bearer ${localStorage.getItem('token')}` 
          } 
        }
      );
      
      // Обновляем список игроков
      const response = await axios.get(`${API_URL}/api/player-rating/top?period=${period}`);
      setPlayers(response.data.players);
      setStats(response.data.stats);
      
      handleCloseDialog();
    } catch (err) {
      console.error('Ошибка при обновлении рейтинга:', err);
      setError('Не удалось обновить рейтинг. Пожалуйста, проверьте авторизацию и попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };
  
  // Обработчик сброса рейтинга игрока
  const handleResetRating = async () => {
    if (!selectedPlayer) return;
    
    if (!confirm(`Вы уверены, что хотите сбросить рейтинг игрока ${selectedPlayer.name}?`)) {
      return;
    }
    
    try {
      setLoading(true);
      await axios.post(
        `${API_URL}/api/player-rating/${selectedPlayer.id}/reset`,
        {},
        { 
          headers: { 
            Authorization: `Bearer ${localStorage.getItem('token')}` 
          } 
        }
      );
      
      // Обновляем список игроков
      const response = await axios.get(`${API_URL}/api/player-rating/top?period=${period}`);
      setPlayers(response.data.players);
      setStats(response.data.stats);
      
      handleCloseDialog();
    } catch (err) {
      console.error('Ошибка при сбросе рейтинга:', err);
      setError('Не удалось сбросить рейтинг. Пожалуйста, проверьте авторизацию и попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 3 }}>
      <Box sx={{ 
        p: 2, 
        borderRadius: 1,
        backgroundColor: theme.palette.background.paper,
      }}>
        <Typography variant="h5" component="h1" gutterBottom color="text.primary">
          Рейтинг игроков
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Tabs
          value={period}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          sx={{ mb: 2, '& .MuiTab-root.Mui-selected': { color: '#3c83f6' }, '& .MuiTabs-indicator': { backgroundColor: '#3c83f6' } }}
        >
          <Tab label="Неделя" value="week" />
          <Tab label="Месяц" value="month" />
          <Tab label="Все время" value="all" />
        </Tabs>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <>
        {/* Карточки со статистикой */}
            <StatsCards stats={stats} />
        
        {/* Таблица игроков */}
            <PlayersTable 
              players={players} 
              isStaff={isStaff} 
              onEditClick={handleOpenDialog}
            />
          </>
        )}
      </Box>
      
      {/* Диалог редактирования очков */}
      {selectedPlayer && (
        <Dialog open={!!selectedPlayer} onClose={handleCloseDialog}>
          <DialogTitle>
            Изменение рейтинга игрока: {selectedPlayer.name}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 1, minWidth: 400 }}>
              <TextField
                fullWidth
                type="number"
                label="Количество очков"
                name="points"
                value={pointsForm.points}
                onChange={handleTextFieldChange}
                inputProps={{ min: 1 }}
                margin="normal"
              />
              
              <FormControl fullWidth margin="normal">
                <InputLabel>Тип очков</InputLabel>
                <Select
                  name="pointType"
                  value={pointsForm.pointType}
                  onChange={handleSelectChange}
                  label="Тип очков"
                >
                  <MenuItem value="gamePoints">Игровые очки</MenuItem>
                  <MenuItem value="nonGamePoints">Внеигровые очки</MenuItem>
                  <MenuItem value="discipline">Дисциплина</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl fullWidth margin="normal">
                <InputLabel>Операция</InputLabel>
                <Select
                  name="operation"
                  value={pointsForm.operation}
                  onChange={handleSelectChange}
                  label="Операция"
                >
                  <MenuItem value="add">Добавить</MenuItem>
                  <MenuItem value="subtract">Вычесть</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={handleResetRating} 
              color="error" 
              variant="outlined"
              startIcon={<RefreshIcon />}
              sx={{ marginRight: 'auto' }}
            >
              Сбросить рейтинг
            </Button>
            
            <Button onClick={handleCloseDialog} color="inherit">
              Отмена
            </Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained" 
              color="primary"
              disabled={!pointsForm.points}
              sx={{ backgroundColor: '#3c83f6', '&:hover': { backgroundColor: '#2d6ad9' } }}
            >
              Сохранить
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
};

// Компонент для отображения карточек статистики
const StatsCards: React.FC<{ stats: Stats }> = ({ stats }) => {
  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      <Grid item xs={6} sm={3}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Всего игроков
            </Typography>
            <Typography variant="h6" component="div" color="primary" sx={{ color: '#3c83f6' }}>
              {stats.totalPlayers}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={6} sm={3}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Активных
            </Typography>
            <Typography variant="h6" component="div" color="primary" sx={{ color: '#3c83f6' }}>
              {stats.activePlayers}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={6} sm={3}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Средний рейтинг
            </Typography>
            <Typography variant="h6" component="div" color="primary" sx={{ color: '#3c83f6' }}>
              {stats.averageRating}
              </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={6} sm={3}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Турниров
                </Typography>
            <Typography variant="h6" component="div" color="primary" sx={{ color: '#3c83f6' }}>
              {stats.monthlyTournaments}
                  </Typography>
            </CardContent>
          </Card>
        </Grid>
    </Grid>
  );
};

// Компонент для отображения таблицы игроков
interface PlayersTableProps {
  players: Player[];
  isStaff: boolean;
  onEditClick: (player: Player) => void;
}

const PlayersTable: React.FC<PlayersTableProps> = ({ players, isStaff, onEditClick }) => {
  // Преобразуем игрока в пользователя для UserAvatar
  const playerToUser = (player: Player): PlayerUser => ({
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    email: '',
    role: 'player',
    _updateTimestamp: Date.now()
  });

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ 
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
      borderRadius: '12px',
      overflow: 'hidden'
    }}>
      <Table size="medium" sx={{ '& .MuiTableCell-root': { py: 2, px: 2.5 } }}>
        <TableHead>
          <TableRow sx={{ backgroundColor: '#3c83f6', color: 'white' }}>
            <TableCell width="60px" sx={{ color: 'white', fontWeight: 'bold' }}>Ранг</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Игрок</TableCell>
            <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Рейтинг</TableCell>
            <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Игровые очки</TableCell>
            <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Внеигровые</TableCell>
            <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Дисциплина</TableCell>
            {isStaff && <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Действия</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {players.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isStaff ? 7 : 6} align="center">
                Нет данных для отображения
              </TableCell>
            </TableRow>
          ) : (
            players.map((player) => (
              <TableRow 
                key={player.id}
                sx={{ 
                  backgroundColor: player.rank === 1 ? 'rgba(255, 215, 0, 0.05)' :
                                   player.rank === 2 ? 'rgba(192, 192, 192, 0.05)' :
                                   player.rank === 3 ? 'rgba(205, 127, 50, 0.05)' :
                                   'transparent',
                  '&:nth-of-type(odd)': { 
                    backgroundColor: player.rank <= 3 ? 
                      'inherit' : 'rgba(60, 131, 246, 0.03)'
                  },
                  '&:last-child td, &:last-child th': { border: 0 },
                  '&:hover': { 
                    backgroundColor: 'rgba(60, 131, 246, 0.08)',
                    transition: 'background-color 0.2s ease'
                  },
                  transition: 'background-color 0.2s ease',
                  cursor: isStaff ? 'pointer' : 'default',
                  borderBottom: '1px solid rgba(224, 224, 224, 0.5)'
                }}
                onClick={isStaff ? () => onEditClick(player) : undefined}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {player.rank === 1 && <StarIcon fontSize="small" sx={{ color: 'gold', mr: 0.5 }} />}
                    <Typography variant="body1" component="span" sx={{
                      fontWeight: player.rank <= 3 ? 'bold' : 'normal',
                      color: player.rank === 1 ? 'gold' : 
                             player.rank === 2 ? 'silver' : 
                             player.rank === 3 ? '#cd7f32' : 'inherit'
                    }}>
                      {player.rank}
                    </Typography>
                  </Box>
                </TableCell>
                
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ 
                      mr: 1.5,
                      border: player.rank <= 3 ? 
                        `2px solid ${player.rank === 1 ? 'gold' : player.rank === 2 ? 'silver' : '#cd7f32'}` : 'none',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2px'
                    }}>
                      <UserAvatar 
                        user={playerToUser(player)}
                        size="md"
                      />
                    </Box>
                    <Typography variant="body1" sx={{ 
                      fontWeight: player.rank <= 3 ? 500 : 'normal'
                    }}>
                      {player.name}
                    </Typography>
                  </Box>
                </TableCell>
                
                <TableCell align="right">
                  <Typography variant="body1" fontWeight="bold" sx={{ 
                    color: '#3c83f6',
                    fontSize: player.rank <= 3 ? '1.1rem' : '1rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end'
                  }}>
                    {player.rating}
                  </Typography>
                </TableCell>
                
                <TableCell align="right">
                  <Typography variant="body1" sx={{
                    color: player.gamePoints > 500 ? '#3c83f6' : 'inherit',
                    fontWeight: player.gamePoints > 500 ? 500 : 'normal'
                  }}>
                    {player.gamePoints}
                  </Typography>
                </TableCell>
                
                <TableCell align="right">
                  <Typography variant="body1" sx={{
                    color: player.nonGamePoints > 500 ? '#3c83f6' : 'inherit',
                    fontWeight: player.nonGamePoints > 500 ? 500 : 'normal'
                  }}>
                    {player.nonGamePoints}
                  </Typography>
                </TableCell>
                
                <TableCell align="right">
                  <Typography variant="body1" sx={{
                    color: player.discipline > 80 ? 'green' : player.discipline < 50 ? '#ff5252' : 'inherit',
                    fontWeight: player.discipline > 80 ? 500 : 'normal'
                  }}>
                    {player.discipline}
                  </Typography>
                </TableCell>
                
                {isStaff && (
                  <TableCell align="right">
                    <IconButton 
                      size="medium" 
                      color="primary" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditClick(player);
                      }}
                      aria-label="изменить"
                      sx={{ 
                        color: '#3c83f6',
                        '&:hover': {
                          backgroundColor: 'rgba(60, 131, 246, 0.1)'
                        }
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TopPlayers; 